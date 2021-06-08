import decimal
import os
import json
import mysql.connector
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

select_blocks = "SELECT * FROM blocks WHERE confirmed = 1 LIMIT {0} OFFSET {1}"

fields = [
    pa.field("hash", pa.string()),
    pa.field("amount", pa.decimal128(38, 0)),
    pa.field("balance", pa.decimal128(38, 0)),
    pa.field("height", pa.int64()),
    pa.field("local_timestamp", pa.int64()),
    pa.field("confirmed", pa.bool_()),
    pa.field("type", pa.int8()),
    pa.field("account", pa.string()),
    pa.field("previous", pa.string()),
    pa.field("representative", pa.string()),
    pa.field("link", pa.string()),
    pa.field("link_as_account", pa.string()),
    pa.field("signature", pa.string()),
    pa.field("work", pa.string()),
    pa.field("subtype", pa.int8()),
]
schema = pa.schema(fields)
filepath = os.path.abspath("../output/blocks.parquet")
offset = 0
batch_size = 10000

with open("config.json") as json_data_file:
    config = json.load(json_data_file)

mysql_config = config["mysql"]["connection"]
cnx = mysql.connector.connect(
    user=mysql_config["user"],
    host=mysql_config["host"],
    password=mysql_config["password"],
    database=mysql_config["database"],
)
cursor = cnx.cursor(dictionary=True)

# get current size of parquet file
try:
    t = pq.read_metadata(filepath)
    offset = t.num_rows
except Exception as ex:
    print("Unable to read {}".format(filepath))

# query mysql
cursor.execute(select_blocks.format(batch_size, offset))
result = cursor.fetchall()
if not len(result):
    print("No new rows to append")
    cursor.close()
    quit()

pqwriter = pq.ParquetWriter(filepath, schema)

while len(result):
    print("writing {} rows to file".format(len(result)))
    # write / append to file
    df_raw = pd.DataFrame(result)
    df_raw["balance"] = df_raw["balance"].apply(lambda x: decimal.Decimal(x))
    df_raw["amount"] = df_raw["amount"].apply(lambda x: decimal.Decimal(x))
    table = pa.Table.from_pandas(df_raw, schema=schema, preserve_index=False)
    pqwriter.write_table(table)

    # load next batch
    offset = offset + batch_size
    cursor.execute(select_blocks.format(batch_size, offset))
    result = cursor.fetchall()

print("Done")
cursor.close()
