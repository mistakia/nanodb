import decimal
import os
import json
import psycopg2
from py2neo import Graph, Node, Relationship
from py2neo.bulk import create_relationships
from py2neo.bulk import merge_nodes
import logging
from joblib import Parallel, delayed
import dill as pickle
import time
from itertools import islice


select_nodes_relations = ( 
"SELECT stats.source_account,                                       "#0
"       a1.open_block as s_open_block,                              "#1
"       a1.balance as s_balance,                                    "#2
"       a1.block_count as s_block_count,                            "#3 
"       stats.destination_account,                                  "#4
"       a2.open_block as d_open_block,                              "#5
"       a2.balance as d_balance,                                    "#6
"       a2.block_count as d_block_count,                            "#7
"	    stats.block_count as interaction_count,                     "#8
"       stats.total_amount as total_amount,                         "#9
"       stats.blocktype                                             "#10
"FROM source_destination_stats stats                                "
"LEFT JOIN accounts a1 on a1.account = stats.source_account         "
"LEFT JOIN accounts a2 on a2.account = stats.destination_account    "
#"limit 500                                                          "
)


def clear_tmp():
    return { "RECEIVED_FROM" : [],
        "SENT_TO" : [],
        "CHANGED_REP" : [],
        "UPGRADED_EPOCH" : []}


    
with open("config.json") as json_data_file:
    config = json.load(json_data_file)
    
postgresql_config = config["postgresql"]["connection"]
conn = psycopg2.connect("host={} port={} dbname={} user={} password={}".format(postgresql_config["host"],postgresql_config["port"],postgresql_config["dbname"],postgresql_config["user"],postgresql_config["password"]))
conn.set_session(autocommit=False)
postgresql_cursor = conn.cursor("sel_all_relations") 
postgresql_cursor.itersize = 50000


t0 = time.time()
print("Export Blocks from Postgres into Neo4j Relations: SQL query started...")  
postgresql_cursor.execute(select_nodes_relations) 
#rows = postgresql_cursor.fetchall()
print("Exec SQL finished for {} nodes".format(postgresql_cursor.rowcount))

mem_relations = clear_tmp()
mem_nodes = []
node_keys = ["address", "open_block", "balance", "block_count"]

count = 0
t0 = time.time()
t1 = time.time()

g = Graph("bolt://192.168.178.88:7687", auth=("neo4j", "rootpw"))

# Disabel the follwoig line if you run the script a second time and you get the error:
# An equivalent constraint already exists, 'Constraint( id=x, name='constraint_xxx', type='UNIQUENESS', schema=(:Account {address}), ownedIndex=x )
g.schema.create_uniqueness_constraint('Account', 'address')

for row in postgresql_cursor:     
    bal1 = int(row[2] or 0)/1e30
    bal2 = int(row[6] or 0)/1e30
    mem_nodes.append([row[0], row[1], bal1, row[3]])
    if row[4] != None: # Genesis received without a destination account
        mem_nodes.append([row[4], row[5] , bal2, row[7]])
    rel = ""
    
    if row[10] == "SEND":
        rel = "SENT_TO"
    elif row[10] == "RECEIVE":
        rel = "RECEIVED_FROM"
    else:
        print("SKIP {} REL {}".format(row[0],row[10]))
        continue
        
    mem_relations[rel].append(
        (row[0], {"interaction_count": row[8], "total_amount":int(row[9])/1e30} , row[4])
    ) 
    
    if count % 1000 == 0:
        print("count: {} relations ".format(count),end="\r",)
    count += 1    
    if count % 50000 == 0:        
        #create nodes
        merge_nodes(g.auto(), mem_nodes, ("Account", "address"), keys=node_keys)
        mem_nodes = []
        for batch_key in mem_relations.keys():  
            #create relations
            try:              
                create_relationships(g.auto(), mem_relations[batch_key], batch_key, \
                    start_node_key=("Account", "address"), 
                    end_node_key=("Account", "address"))
            except Exception as ex:
                print(ex)            
            print(".", end='')
        mem_relations = clear_tmp()   
        t1 = time.time()

#create nodes
merge_nodes(g.auto(), mem_nodes, ("Account", "address"), keys=node_keys)
for batch_key in mem_relations.keys():  
    try:  
        create_relationships(g.auto(), mem_relations[batch_key], batch_key, \
            start_node_key=("Account", "address"), end_node_key=("Account", "address"))
    except Exception as ex:
        print(ex)            
     
print("Exported Everything in {} seconds".format(t1-t0))

    
  


