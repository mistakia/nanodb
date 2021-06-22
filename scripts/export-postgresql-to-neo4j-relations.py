import decimal
import os
import json
import psycopg2
from py2neo import Graph, Node, Relationship
from py2neo.bulk import create_relationships
import logging
from joblib import Parallel, delayed
import dill as pickle
import time



select_nodes_relations = ( 
"select  b1.type, 	                                    " #0
"		b1.subtype,                                     " #1
"		b1.account as source_account,                   " #2
"		b2.account as received_from_destination,	    "#3
"		b1.link_as_account as send_to_destination,	    "#4
"		b1.hash,                                        "#5
"		b1.amount,                                      "#6
"		b1.balance,                                     "#7
"		b1.height,                                      "#8
"		b1.local_timestamp,                             "#9
"		b1.confirmed,                                   "#10
"		b1.previous,                                    "#11
"		b1.representative,                              "#12
"		b1.signature,                                   "#13
"		b1.work                                         "#14
"from blocks b1                                         "
"left join blocks b2 on b2.hash = b1.link               "
#"order by hash                                          "
#"limit 5000"
)


def get_block_type(i):
    switcher={                
            1:'state',
            2:'open',
            3:'receive',
            4:'send',
            5:'change',
            }
    return switcher.get(i,"Unknown")

def get_block_subtype(i):
    switcher={       
            1:'open',
            2:'receive',
            3:'send',
            4:'change',
            5:'epoch'
            }
    return switcher.get(i,None)

def clear_tmp():
    return { "RECEIVED_FROM" : [],
        "SENT_TO" : [],
        "CHANGED_REP" : [],
        "UPGRADED_EPOCH" : []}

def get_relation(btype,subtype):    
    if btype in [1,2,3] and (subtype == None or (subtype in [1,2])):
        return "RECEIVED_FROM"
    elif btype in [1,4] and (subtype == None or (subtype == 3)):
        return "SENT_TO"
    elif btype in [1,5] and (subtype == None or (subtype == 4)):
        return "CHANGED_REP"
    elif btype == 1 and subtype == 5:
        return "UPGRADED_EPOCH"
    else:
        return None  
    
def addRelations(data):
    try:
        g = Graph("bolt://192.168.178.88:7687", auth=("neo4j", "rootpw"))
        
        for batch_key in tmp.keys():        
            create_relationships(g.auto(), data[batch_key], batch_key, \
                start_node_key=("Account", "address"), end_node_key=("Account", "address"))
        print("Parallel import succeeded")
    except Exception as ex:
        print(ex)
    
    
with open("config.json") as json_data_file:
    config = json.load(json_data_file)
    
postgresql_config = config["postgresql"]["connection"]
conn = psycopg2.connect("host={} port={} dbname={} user={} password={}".format(postgresql_config["host"],postgresql_config["port"],postgresql_config["dbname"],postgresql_config["user"],postgresql_config["password"]))
conn.set_session(autocommit=False)
postgresql_cursor = conn.cursor("sel_all_relations") 
postgresql_cursor.itersize = 50000





#postgresql_cursor = conn.cursor() 

g = Graph("bolt://192.168.178.88:7687", auth=("neo4j", "rootpw"))
#CREATE CONSTRAINT ON (n:Account) ASSERT n.address IS UNIQUE


t0 = time.time()
print("Export Blocks from Postgres into Neo4j Relations: SQL query started...")  
postgresql_cursor.execute(select_nodes_relations) 
print("Exec SQL finished for {} nodes".format(postgresql_cursor.rowcount))

mem_cache = clear_tmp()

count = 0
t0 = time.time()
t1 = time.time()

for row in postgresql_cursor: 
    
    btype = get_block_type(row[0])
    subtype = get_block_subtype(row[1])
    rel = get_relation(row[0],row[1])    
    
    if rel == "RECEIVED_FROM" :
        # if(row[3] == None) :
            # print("ERROR RECEIVED_FROM for hash {}".format(row[5]))
        mem_cache[rel].append(
            (row[2], {"hash": row[5],"type": btype, "subtype":subtype, "balance": int(row[7])/1e30, "amount" : int(row[6])/1e30 , "height" : int(row[8]), "local_timestamp": row[9], "confirmed":row[10], "previous": row[11], "representative" : row[12], "work":row[13] , "signature": row[14]} , row[3])
        )        
    elif rel == "SENT_TO" :
        mem_cache[rel].append(
            (row[2], {"hash": row[5],"type": btype, "subtype":subtype, "balance": int(row[7])/1e30, "amount" : int(row[6])/1e30 , "height" : int(row[8]), "local_timestamp": row[9], "confirmed":row[10], "previous": row[11], "representative" : row[12], "work":row[13] , "signature": row[14]} , row[4]) 
        )        
    elif rel == "CHANGED_REP":
        mem_cache[rel].append(
            (row[2], {"hash": row[5],"type": btype, "subtype":subtype, "balance": int(row[7])/1e30, "amount" : int(row[6])/1e30 , "height" : int(row[8]), "local_timestamp": row[9], "confirmed":row[10], "previous": row[11], "representative" : row[12], "work":row[13] , "signature": row[14]} , row[12]) 
        )        
    elif rel == "UPGRADED_EPOCH":
    #GENESIS send epoch block to account
        mem_cache[rel].append(
            ("nano_3t6k35gi95xu6tergt6p69ck76ogmitsa8mnijtpxm9fkcm736xtoncuohr3", {"hash": row[5],"type": btype, "subtype":subtype, "balance": int(row[7])/1e30, "amount" : int(row[6])/1e30 , "height" : int(row[8]), "local_timestamp": row[9], "confirmed":row[10], "previous": row[11], "representative" : row[12], "work":row[13] , "signature": row[14]} , row[2])
        )
    if count % 1000 == 0:
        print("count: {} relations ".format(count),end="\r",)
    count += 1    
    if count % 50000 == 0:       
        for batch_key in mem_cache.keys():  
            try:
                g = Graph("bolt://192.168.178.88:7687", auth=("neo4j", "rootpw"))
                create_relationships(g.auto(), mem_cache[batch_key], batch_key, \
                    start_node_key=("Account", "address"), end_node_key=("Account", "address"))
            except Exception as ex:
                print(ex)
            #print("{} : {} relations imported".format(batch_key,len(mem_cache[batch_key])))
            print(".", end='')
        mem_cache = clear_tmp()
        t2 = time.time()
        print("Imported current relations in {} seconds".format(t2-t1))
        t1 = time.time()

for batch_key in mem_cache.keys():  
    try:
        g = Graph("bolt://192.168.178.88:7687", auth=("neo4j", "rootpw"))
        create_relationships(g.auto(), mem_cache[batch_key], batch_key, \
            start_node_key=("Account", "address"), end_node_key=("Account", "address"))
        print(".", end='')
    except Exception as ex:
        print(ex)
    #print("{} : {} relations imported".format(batch_key,len(mem_cache[batch_key])))

t1 = time.time()          
#mem_cache.append(tmp)

print("Exported Everything in {} seconds".format(t1-t0))


    
    
  


