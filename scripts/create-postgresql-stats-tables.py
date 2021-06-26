import decimal
import os
import json
import psycopg2



create_account_stats = (
"CREATE TABLE account_stats AS                                                                   "
"SELECT account, count(*) as block_count ,sum(amount) as total_amount ,'SEND' as blocktype       "
#"INTO account_stats                                                                              "
"FROM blocks b1                                                                                  "
"WHERE b1.type in (1,4) AND (b1.subtype ISNULL or b1.subtype = 3) group by account               "
"UNION ALL                                                                                       "
"SELECT account, count(*) as block_count ,sum(amount) as total_amount,'RECEIVE' as blocktype     "
"FROM blocks b1                                                                                  "
"WHERE b1.type in (1,2,3) AND (b1.subtype ISNULL or b1.subtype IN (1, 2)) group by account       "
)


source_destination_stats = (
"CREATE TABLE source_destination_stats AS                                                                                    "
"SELECT source_account,destination_account, count(*) as block_count ,sum(amount) as total_amount,'SEND' as blocktype         "
#"INTO source_destination_stats                                                                                               "
"FROM                                                                                                                        "
"(  SELECT b1.account as source_account, b1.link_as_account as destination_account,b1.amount                                 "
"   FROM blocks b1                                                                                                           "
"   WHERE b1.type in (1,4) AND (b1.subtype ISNULL or b1.subtype = 3)) as t1                                                  "
"GROUP BY source_account,destination_account                                                                                 "
"UNION ALL                                                                                                                   "
"SELECT source_account,destination_account, count(*) as block_count ,sum(amount) as total_amount,'RECEIVE' as blocktype from "
"(  SELECT b1.account as source_account, b2.account as destination_account,b1.amount                                         "
"   FROM blocks b1                                                                                                           "
"   LEFT JOIN blocks b2 on b2.hash = b1.link                                                                                 "
"   WHERE b1.type in (1,2,3) AND (b1.subtype ISNULL or b1.subtype IN (1, 2))) as t1                                          "
"GROUP BY source_account,destination_account                                                                                 "
)


   
with open("config.json") as json_data_file:
    config = json.load(json_data_file)
    
postgresql_config = config["postgresql"]["connection"]
conn = psycopg2.connect("host={} port={} dbname={} user={} password={}".format(postgresql_config["host"],postgresql_config["port"],postgresql_config["dbname"],postgresql_config["user"],postgresql_config["password"]))
conn.set_session(autocommit=True)
postgresql_cursor = conn.cursor() 
print("Start Create 'account_stats' Table")
postgresql_cursor.execute(create_account_stats) 
print("End Create 'account_stats' Table")

# print("Start Create 'source_destination_stats' Table")
# postgresql_cursor.execute(source_destination_stats) 
# print("End Create 'source_destination_stats' Table")
     


    
  


