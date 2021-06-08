#!/bin/sh

DUMP_DIR="./output"
DB_NAME="nanodb_development"
DB_FILE="/root/mysqldump.cnf"

file_name="$(date +$DATE_FORMAT)"
accounts_sql_file="accounts-$file_name.sql"
accounts_gz_file="accounts-$file_name.tar.gz"
blocks_sql_file="blocks-$file_name.sql"
blocks_gz_file="blocks-$file_name.tar.gz"

SECONDS=0
echo "Exporting accounts to parquet..."
python3 ./scripts/export-mysql-to-parquet-accounts.py
duration=$SECONDS
echo "Completed in $(($duration / 60)) minutes and $(($duration % 60)) seconds elapsed."

SECONDS=0
echo "Exporting blocks to parquet..."
python3 ./scripts/export-mysql-to-parquet-blocks.py
duration=$SECONDS
echo "Completed in $(($duration / 60)) minutes and $(($duration % 60)) seconds elapsed."

cd $DUMP_DIR

SECONDS=0
echo "Exporting accounts to sql file..."
mysqldump --defaults-extra-file=$DB_FILE $DB_NAME "accounts" > $accounts_sql_file
duration=$SECONDS
echo "Completed in $(($duration / 60)) minutes and $(($duration % 60)) seconds elapsed."

SECONDS=0
echo "Exporting blocks to sql file..."
mysqldump --defaults-extra-file=$DB_FILE $DB_NAME "blocks" > $blocks_sql_file
duration=$SECONDS
echo "Completed in $(($duration / 60)) minutes and $(($duration % 60)) seconds elapsed."

tar -zvcf $accounts_gz_file $accounts_sql_file
rm $accounts_sql_file

tar -zvcf $blocks_gz_file $blocks_sql_file
rm $blocks_sql_file

rclone sync output remote:
