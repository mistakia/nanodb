import decimal
import json
import mysql.connector
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

select_accounts = (
    "SELECT * FROM accounts LIMIT {0} OFFSET {1}"
)

fields = [
    pa.field('account', pa.string()),
    pa.field('frontier', pa.string()),
    pa.field('open_block', pa.string()),
    pa.field('representative_block', pa.string()),
    pa.field('balance', pa.decimal128(38,0)),
    pa.field('modified_timestamp', pa.int64()),
    pa.field('block_count', pa.int64()),
    pa.field('confirmation_height', pa.int64()),
    pa.field('confirmation_height_frontier', pa.string()),
    pa.field('representative', pa.string()),
    pa.field('weight', pa.decimal128(38,0)),
    pa.field('pending', pa.decimal128(38,0))
]
schema = pa.schema(fields)
filepath = 'accounts.parquet'
offset = 0
batch_size = 10000

with open("config.json") as json_data_file:
    config = json.load(json_data_file)

mysql_config = config["mysql"]["connection"]
cnx = mysql.connector.connect(
    user=mysql_config["user"],
    host=mysql_config["host"],
    database=mysql_config["database"],
)
cursor = cnx.cursor(dictionary=True)

# get current size of parquet file
try:
    t = pq.read_metadata(filepath)
    offset = t.num_rows
except Exception as ex:
    print('Unable to read {}'.format(filepath))

# query mysql
cursor.execute(select_accounts.format(batch_size, offset))
result = cursor.fetchall()
if not len(result):
    print('No new rows to append')
    cursor.close()
    quit()

pqwriter = pq.ParquetWriter(filepath, schema)

while (len(result)):
    print('writing {} rows to file'.format(len(result)))
    # write / append to file
    df_raw = pd.DataFrame(result)
    df_raw['balance'] = df_raw['balance'].apply(lambda x: decimal.Decimal(x))
    df_raw['weight'] = df_raw['weight'].apply(lambda x: decimal.Decimal(x))
    df_raw['pending'] = df_raw['pending'].apply(lambda x: decimal.Decimal(x))
    table = pa.Table.from_pandas(
        df_raw,
        schema=schema,
        preserve_index=False
    )
    pqwriter.write_table(table)

    # load next batch
    offset = offset + batch_size
    cursor.execute(select_accounts.format(batch_size, offset))
    result = cursor.fetchall()

print('Done')
cursor.close()
