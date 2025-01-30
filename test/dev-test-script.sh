#!/bin/bash

# if no parameter pass in, use node . otherwise, use the first parameter as the command
if [ $# -eq 0 ]; then
  prog="node ."
else
  prog="$1"
fi

run_test() {
  local header="$1"
  local command="$2"
  local exit_code="$3"

  echo "=========================="
  echo "Test ... $header"
  echo "=========================="

  echo "Executing: $command"

  eval "$command"

  # check return code


  if [ $? -ne 0 ]; then
    if [ -n "$exit_code" ]; then
      echo "   ... (Failed as expected)"
    else
      echo "Test failed"
      exit 1
    fi
  fi
}

run_test "Generate query:" "$prog query create 'give me numbers of columns for each table'"

run_test "Generate query and run it:" "$prog query create 'give me numbers of columns for each table' | $prog query run"

run_test "List database" "$prog database list --all_users"

run_test "Add database" "$prog database add --connect_string postgresql://waii@localhost:5432/waii_sdk_test2"

run_test "Delete database" "$prog database delete postgresql://waii@localhost:5432/waii_sdk_test2"

run_test "Activate database (snowflake://whathappened@wjhotuk-hdb56222/SNOWFLAKE_SAMPLE_DATA)" \
  "$prog database activate 'snowflake://whathappened@wjhotuk-hdb56222/SNOWFLAKE_SAMPLE_DATA?role=ACCOUNTADMIN&warehouse=COMPUTE_WH' && $prog database describe"

run_test "Activate database (snowflake://TWEAKIT_USER@gqobxjv-bhb91428/TWEAKIT_PLAYGROUND)" \
  "$prog database activate 'snowflake://TWEAKIT_USER@gqobxjv-bhb91428/TWEAKIT_PLAYGROUND?role=TWEAKIT_USER_ROLE&warehouse=COMPUTE_WH' && $prog database describe"

run_test "Schema describe (normal case)" \
  "$prog schema describe 'TWEAKIT_PLAYGROUND.RETAIL_DATA'"

run_test "Schema describe (lower case, and only schema name)" \
  "$prog schema describe 'retail_data'"

run_test "context list" "$prog context list"

run_test "schema list" "$prog schema list"

run_test "table list" "$prog table list"

run_test "table describe" "$prog table describe 'TWEAKIT_PLAYGROUND.RETAIL_DATA.CUSTOMER'"
run_test "table describe" "$prog table describe 'RETAIL_DATA.CUSTOMER'"
run_test "table describe" "$prog table describe 'TABLES'"

run_test "table describe (lower case, and only table name)" "$prog table describe CUSTOMER_demographics" "-1"

run_test "table describe failure case" "$prog table describe not_existed_schema.customer_demographics" "-1"

run_test "table describe failure case" "$prog table describe not_existed_table" "-1"

run_test "table describe failure case" "$prog table describe 'NOT_EXISTED_DB.RETAIL_DATA.CUSTOMER'" "-1"

run_test "explain query" "echo 'select * from information_schema.tables, information_schema.columns' | $prog query explain"

run_test "update query" "echo 'select * from information_schema.tables' | $prog query update 'add columns to cross join'"

sql_query=$(cat <<EOF
select s_store_name, s_store_id,
        sum(case when (d_day_name='Sunday') then ss_sales_price else null end) sun_sales,
        sum(case when (d_day_name='Monday') then ss_sales_price else null end) mon_sales,
        sum(case when (d_day_name='Tuesday') then ss_sales_price else null end) tue_sales,
        sum(case when (d_day_name='Wednesday') then ss_sales_price else null end) wed_sales,
        sum(case when (d_day_name='Thursday') then ss_sales_price else null end) thu_sales,
        sum(case when (d_day_name='Friday') then ss_sales_price else null end) fri_sales,
        sum(case when (d_day_name='Saturday') then ss_sales_price else null end) sat_sales
 from date_dim, store_sales, store
 where d_date_sk = ss_sold_date_sk and
       s_store_sk = ss_store_sk and
       s_gmt_offset = -5 and
       d_year = 2000
 group by s_store_name, s_store_id
 order by s_store_name, s_store_id,sun_sales,mon_sales,tue_sales,wed_sales,
          thu_sales,fri_sales,sat_sales
 limit 100
EOF
)
run_test "rewrite query" 'echo "$sql_query" | $prog query rewrite'

pyspark=$(cat <<EOF
from pyspark.sql import functions as F

result = (
    date_dim.join(store_sales, date_dim["d_date_sk"] == store_sales["ss_sold_date_sk"])
    .join(store, (store["s_store_sk"] == store_sales["ss_store_sk"]) & (store["s_gmt_offset"] == -5))
    .filter(date_dim["d_year"] == 2000)
    .groupBy(store["s_store_name"], store["s_store_id"])
    .agg(
        F.sum(F.when(date_dim["d_day_name"] == "Sunday", store_sales["ss_sales_price"]).otherwise(F.lit(None))).alias("sun_sales"),
        F.sum(F.when(date_dim["d_day_name"] == "Monday", store_sales["ss_sales_price"]).otherwise(F.lit(None))).alias("mon_sales"),
        F.sum(F.when(date_dim["d_day_name"] == "Tuesday", store_sales["ss_sales_price"]).otherwise(F.lit(None))).alias("tue_sales"),
        F.sum(F.when(date_dim["d_day_name"] == "Wednesday", store_sales["ss_sales_price"]).otherwise(F.lit(None))).alias("wed_sales"),
        F.sum(F.when(date_dim["d_day_name"] == "Thursday", store_sales["ss_sales_price"]).otherwise(F.lit(None))).alias("thu_sales"),
        F.sum(F.when(date_dim["d_day_name"] == "Friday", store_sales["ss_sales_price"]).otherwise(F.lit(None))).alias("fri_sales"),
        F.sum(F.when(date_dim["d_day_name"] == "Saturday", store_sales["ss_sales_price"]).otherwise(F.lit(None))).alias("sat_sales"),
    )
    .orderBy(
        store["s_store_name"],
        store["s_store_id"],
        "sun_sales",
        "mon_sales",
        "tue_sales",
        "wed_sales",
        "thu_sales",
        "fri_sales",
        "sat_sales",
    )
    .limit(100)
)

EOF
)
run_test "transcode query" 'echo "$pyspark" | $prog query transcode -from pyspark -to snowflake'
run_test "history list" "$prog history list -limit 1"
