import decimal
import os
import json
import psycopg2
from py2neo import Graph, Node, Relationship
import logging
from joblib import Parallel, delayed
import dill as pickle
import time



select_nodes_all = ("select                                                         "
                    "   b1.link_as_account,                                         "#0
                    "   a1.open_block,                                              "#1
                    "   a1.balance,                                                 "#2
                    "   a1.block_count,                                             "#3
                    "   a1.confirmation_height,                                     "#4
                    "   b1.representative,                                          "#5
                    "   a2.open_block,                                              "#6
                    "   a2.balance,                                                 "#7
                    "   a2.block_count,                                             "#8
                    "   a2.confirmation_height                                      "#9
                    "from blocks as b1                                              "
                    "left join accounts a1 on a1.account =  b1.link_as_account      "
                    "left join accounts a2 on a2.account =  b1.representative       "
                    "where type in (1,4) and (subtype = 3 or subtype ISNULL)        " )


    
    
def addNodes(mem_cache):
    try:
        g = Graph("bolt://192.168.178.88:7687", auth=("neo4j", "rootpw"))
        tx = g.begin()
        for row in mem_cache:  
            r_balance = row[2]
            if row[2] == None :
                r_balance = 0
            
            tx.create(Node("Account", address=row[0], open_block=row[1], balance=int(r_balance)/1e30, block_count=row[3],confirmation_height=row[4] ))
        g.commit(tx)
        print(".", end='')
    except Exception as ex:
        print(ex)
    
    
with open("config.json") as json_data_file:
    config = json.load(json_data_file)
    
postgresql_config = config["postgresql"]["connection"]
conn = psycopg2.connect("host={} port={} dbname={} user={} password={}".format(postgresql_config["host"],postgresql_config["port"],postgresql_config["dbname"],postgresql_config["user"],postgresql_config["password"]))
conn.set_session(autocommit=False)
postgresql_cursor = conn.cursor("sel_all_nodes") as

#g = Graph("bolt://192.168.178.88:7687", auth=("neo4j", "rootpw"))
# g.delete_all()


count = 0

continue_loop = True
unique_set = set()

t0 = time.time()
print("Exec SQL started")  
postgresql_cursor.execute(select_nodes_all)
postgresql_cursor.itersize = 50000
#rows = postgresql_cursor.fetchall()
print("Exec SQL finished for {} nodes".format(postgresql_cursor.rowcount))

for row in postgresql_cursor:     
    unique_set.add((row[0], row[1], row[2], row[3], row[4]))
    unique_set.add((row[5], row[6], row[7], row[8], row[9]))
    if count % 10000 == 0 :
      print(
          "count: {} hashes".format(count#, block_key.hash.hex().upper()),
          ),end="\r",
      )
    count += 1
t1 = time.time()

print("Exported {} nodes in {} seconds".format(len(unique_set), t1-t0))

mem_cache = []
tmp = []
count = 0
for el in unique_set:
    tmp.append(el)
    count += 1
    if count % 100 == 0:
        mem_cache.append(tmp)
        tmp = []
mem_cache.append(tmp)
print(sum(len(x) for x in mem_cache))
  
Parallel(n_jobs=32)(delayed(addNodes)(el) for el in mem_cache)
t2 = time.time()
print("Imported {} nodes in {} seconds".format(len(unique_set), t2-t1))

    
    
  


