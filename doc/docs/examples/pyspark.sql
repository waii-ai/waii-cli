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
