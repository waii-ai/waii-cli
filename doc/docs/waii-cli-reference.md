# WAII CLI Reference

The WAII CLI provides a command-line interface for interacting with WAII services.

## Table of Contents

- [query](#query)
  - [`waii query create`](#waii-query-create)
  - [`waii query update`](#waii-query-update)
  - [`waii query explain`](#waii-query-explain)
  - [`waii query describe`](#waii-query-describe)
  - [`waii query rewrite`](#waii-query-rewrite)
  - [`waii query transcode`](#waii-query-transcode)
  - [`waii query diff`](#waii-query-diff)
  - [`waii query run`](#waii-query-run)
  - [`waii query analyze`](#waii-query-analyze)
  - [`waii query generate_question`](#waii-query-generate_question)
- [database](#database)
  - [`waii database list`](#waii-database-list)
  - [`waii database add`](#waii-database-add)
  - [`waii database delete`](#waii-database-delete)
  - [`waii database activate`](#waii-database-activate)
  - [`waii database describe`](#waii-database-describe)
  - [`waii database extract_doc`](#waii-database-extract_doc)
- [context](#context)
  - [`waii context list`](#waii-context-list)
  - [`waii context add`](#waii-context-add)
  - [`waii context delete`](#waii-context-delete)
  - [`waii context import`](#waii-context-import)
  - [`waii context delete_all`](#waii-context-delete_all)
- [schema](#schema)
  - [`waii schema describe`](#waii-schema-describe)
  - [`waii schema list`](#waii-schema-list)
  - [`waii schema update`](#waii-schema-update)
  - [`waii schema update_questions`](#waii-schema-update_questions)
  - [`waii schema update_summary`](#waii-schema-update_summary)
  - [`waii schema migrate`](#waii-schema-migrate)
- [table](#table)
  - [`waii table describe`](#waii-table-describe)
  - [`waii table list`](#waii-table-list)
  - [`waii table update`](#waii-table-update)
  - [`waii table migrate`](#waii-table-migrate)
  - [`waii table ddl`](#waii-table-ddl)
- [history](#history)
  - [`waii history list`](#waii-history-list)
- [user](#user)
  - [`waii user create_access_key`](#waii-user-create_access_key)
  - [`waii user list_access_keys`](#waii-user-list_access_keys)
  - [`waii user delete_access_key`](#waii-user-delete_access_key)
  - [`waii user info`](#waii-user-info)
  - [`waii user update_config`](#waii-user-update_config)
  - [`waii user create`](#waii-user-create)
  - [`waii user delete`](#waii-user-delete)
  - [`waii user update`](#waii-user-update)
  - [`waii user list`](#waii-user-list)
  - [`waii user create_tenant`](#waii-user-create_tenant)
  - [`waii user update_tenant`](#waii-user-update_tenant)
  - [`waii user delete_tenant`](#waii-user-delete_tenant)
  - [`waii user list_tenant`](#waii-user-list_tenant)
  - [`waii user create_org`](#waii-user-create_org)
  - [`waii user update_org`](#waii-user-update_org)
  - [`waii user delete_org`](#waii-user-delete_org)
  - [`waii user list_org`](#waii-user-list_org)
- [semantic-layer](#semantic-layer)
  - [`waii semantic-layer export`](#waii-semantic-layer-export)
  - [`waii semantic-layer import`](#waii-semantic-layer-import)
- [docs](#docs)
  - [`waii docs generate`](#waii-docs-generate)

## Available Commands


## query

### `waii query create`

Generate a query from text. Pass a question or instructions and receive the query in response.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| ask - a question or set of instructions to generate the query. | | |

#### Options

| Option | Description |
|---------|-------------|
| `--format` | choose the format of the response: text or json |
| `--dialect` | choose the database backend: snowflake or postgres |

#### Examples

Example 1: Generate a query to count columns
```
waii query create "How many columns for each table in the database? Include table name and schema name"
```


```

SELECT 
    table_schema,
    table_name,
    COUNT(*) as num_columns
FROM information_schema.columns
GROUP BY table_schema, table_name
ORDER BY table_schema, table_name;

```


Example 2: Find customer spending patterns
```
waii query create "Find customers whose increase in spend from the first month of the year to the last month of the year has increased more in 2001 than in 2000."
```


```

WITH customer_spending AS (
    SELECT 
        c_customer_sk,
        YEAR(d_date) as year,
        SUM(CASE WHEN d_moy = 1 THEN ss_net_paid ELSE 0 END) as first_month_spend,
        SUM(CASE WHEN d_moy = 12 THEN ss_net_paid ELSE 0 END) as last_month_spend
    FROM store_sales
    JOIN date_dim ON ss_sold_date_sk = d_date_sk
    WHERE YEAR(d_date) IN (2000, 2001)
    GROUP BY c_customer_sk, YEAR(d_date)
)
SELECT 
    cs1.c_customer_sk
FROM customer_spending cs1
JOIN customer_spending cs2 ON cs1.c_customer_sk = cs2.c_customer_sk
WHERE cs1.year = 2001 
AND cs2.year = 2000
AND (cs1.last_month_spend - cs1.first_month_spend) > 
    (cs2.last_month_spend - cs2.first_month_spend);

```


---

### `waii query update`

Update a query from text. Pass a question or instructions and receive the query in response.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| instructions - a set of instructions to update the query. | | |

#### Options

| Option | Description |
|---------|-------------|
| `--format` | choose the format of the response: text or json. |
| `--dialect` | choose the database backend: snowflake or postgres. |
| `--schema` | optional schema name that the query uses. |

---

### `waii query explain`

Explain a query.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| query - the query to explain | | |

#### Options

| Option | Description |
|---------|-------------|
| `--format` | choose the format of the response: text or json. |

#### Examples

Example: Describe a complex query
```
cat my-complex-query.sql | waii query describe
```


```

Query Analysis:
--------------
This query analyzes customer spending patterns by:
1. Calculating monthly spending for each customer in 2000 and 2001
2. Comparing the spending increase between first and last months
3. Finding customers with higher spending growth in 2001 vs 2000

Tables Used:
- store_sales
- date_dim
- customer

Key Operations:
1. Joins store_sales with date_dim to get temporal information
2. Aggregates spending by customer and year
3. Self-joins results to compare year-over-year changes

```


---

### `waii query describe`

Compare two queries and explain the differences.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| qf_1: the first query | | |
| qf_2: the second query | | |

#### Options

| Option | Description |
|---------|-------------|
| `--format` | choose the format of the response: text or json. |
| `--dialect` | choose the database backend: snowflake or postgres. |
| `--qf_1` | filename of a file containing the first query |
| `--qf_2` | filename of a file containing the second query |

---

### `waii query rewrite`

Rewrite the query in a more readable and performant way.

#### Options

| Option | Description |
|---------|-------------|
| `--format` | choose the format of the response: text or json |
| `--dialect` | choose the database backend: snowflake or postgres |

---

### `waii query transcode`

Translate queries from one dialect to another, if multiple queries are provided, they will be converted one by one.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| ask - you can specify additional instructions to translate the query, such as 'use the test schema for converted query' | | |

#### Options

| Option | Description |
|---------|-------------|
| `--format` | choose the format of the response: text or json |
| `--from` | choose the database backend to translate from: snowflake or postgres |
| `--to` | choose the database backend to translate to: snowflake or postgres |
| `--split_queries` | split the input into multiple queries and convert them one by one. Default is true. |

#### Examples

Example: Convert PySpark query to Snowflake SQL
```
cat pyspark.sql | waii query transcode -from pyspark -to snowflake
```


---

### `waii query diff`

Compare two queries and explain the differences.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| qf_1: the first query | | |
| qf_2: the second query | | |

#### Options

| Option | Description |
|---------|-------------|
| `--format` | choose the format of the response: text or json. |
| `--dialect` | choose the database backend: snowflake or postgres. |
| `--qf_1` | filename of a file containing the first query |
| `--qf_2` | filename of a file containing the second query |

---

### `waii query run`

Execute the query and return the results

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| query - you can specify the query to run as a parameter. | | |

#### Options

| Option | Description |
|---------|-------------|
| `--format` | choose the format of the response: text or json |
| `--schema` | use the schema given as the schema for the query. format: \<db\>.\<schema\> |

#### Examples

Example: Run a complex query
```
cat <<EOF | waii query run
WITH joined_data AS (
    SELECT
        c.name AS country_name,
        ci.population AS city_population
    FROM tweakit_playground.world.city AS ci
    INNER JOIN tweakit_playground.world.country AS c
        ON ci.countrycode = c.code
)

SELECT
    country_name,
    AVG(city_population) AS avg_city_population
FROM joined_data
GROUP BY
    country_name
EOF
```


```

┌─────────────────┬────────────────────┐
│ country_name    │ avg_city_population│
├─────────────────┼────────────────────┤
│ United States   │ 286,955            │
│ China           │ 842,233            │
│ India           │ 534,489            │
└─────────────────┴────────────────────┘

```


---

### `waii query analyze`

Analyze query performance.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| query - you can specify the query to run and analyze as a parameter. | | |

#### Options

| Option | Description |
|---------|-------------|
| `--format` | choose the format of the response: text or json |
| `--query` | You can specify the query to run and analyze as an option as well |
| `--query_id` | You can specify a query that ran already and get performance insights. |
| `--summary` | Print the performance analysis summary. |
| `--recommendations` | Print recommendations on how to improve the query. |
| `--query_text` | Print query (useful when you're using query_id) |
| `--times` | Print the query execution and compile time. |

---

### `waii query generate_question`

Generate questions based on the database schema.

#### Options

| Option | Description |
|---------|-------------|
| `--schema` | Name of the schema to generate questions for. |
| `--complexity` | Complexity of the questions to generate: easy, medium, hard |
| `--n_questions` | Number of questions to generate |
| `--format` | choose the format of the response: text or json |

---


## database

### `waii database list`

List all the configured databases.

#### Options

| Option | Description |
|---------|-------------|
| `--format` | choose the format of the response: text or json. |
| `--all_users` | list all database connections (for admins) |
| `--user_id` | list database connections by impersonating another user |

#### Examples

Example: List all databases
```
waii database list
```


```

┌──────────────────┬────────────────────┬────────────┬───────────────────┬──────────────┐
│ account_name     │ database           │ warehouse  │ role              │ username     │
├──────────────────┼────────────────────┼────────────┼───────────────────┼──────────────┤
│ gq.........91428 │ TWEAKIT_PLAYGROUND │ COMPUTE_WH │ TWEAKIT_USER_ROLE │ TWEAKIT_USER │
└──────────────────┴────────────────────┴────────────┴───────────────────┴──────────────┘

```


---

### `waii database add`

Add a database connection.

#### Options

| Option | Description |
|---------|-------------|
| `--format` | choose the format of the response: text or json. |
| `--db_type` | type of database (snowflake, postgresql, mysql, oracle, etc.) |
| `--connect_string` | specify connection string instead of individual fields |
| `--account` | account name (required for snowflake) |
| `--db` | database name |
| `--warehouse` | warehouse name (required for snowflake) |
| `--role` | role name (required for snowflake) |
| `--user` | user name |
| `--password` | password |
| `--host` | host name (required for postgresql, mysql, oracle, etc.) |
| `--port` | port number (optional for postgresql, mysql, oracle, etc.) |
| `--path` | path (used for sqlite) |
| `--no_column_samples` | if set, will not sample columns |

#### Examples

Example: Add a snowflake database
```
waii database add --account 'xxxxx-yyyyy' --db '<DB>' --warehouse '<COMPUTE_WH>' --role '<YOUR_SNOWFLAKE_ROLE>' --user '<YOUR_SNOWFLAKE_USER>' --password '********'
```


Example: Add a PostgreSQL database
```
waii database add --db_type postgresql --host 'localhost' --db 'mydatabase' --user 'dbuser' --password 'password'
```


Example: Add a database using connection string
```
waii database add --connect_string 'postgresql://user:password@localhost:5432/mydatabase'
```


---

### `waii database delete`

Delete a database connection.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| url - the database key to be deleted. | | |

#### Options

| Option | Description |
|---------|-------------|
| `--format` | choose the format of the response: text or json. |
| `--all_users` | delete all database connections (for admins) |
| `--user_id` | delete database connections by impersonating another user |

---

### `waii database activate`

Activate a database for use in generating queries and getting table information.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| url - URL of the database to activate (can be found by running 'waii database list') | | |

#### Examples

Example: Activate a database
```
waii database activate <url_of_the_database>
```


Note: The URL can be found by running 'waii database list'

---

### `waii database describe`

Describe the current database.

#### Options

| Option | Description |
|---------|-------------|
| `--format` | choose the format of the response: text or json. |

---

### `waii database extract_doc`

Extract database documentation.

#### Options

| Option | Description |
|---------|-------------|
| `--url` | Web URL to extract documentation from. |
| `--file` | File path to extract documentation from. |
| `--doc_type` | Content type of the file, text/html, etc. |
| `--schemas` | Comma separated list of schemas to extract documentation from. If not provided, will search in all schemas. |
| `--tables` | Comma separated list of tables to extract documentation from. If schema is not provided, will search in all tables. |
| `--update` | If set to true, will update the existing semantic context, default is false. |

#### Examples

Example: Extract documentation from a web page
```
waii database extract_doc --url "https://fleetdm.com/tables/chrome_extensions" --update true
```


Example: Extract documentation from a text file
```
waii database extract_doc --file "path/to/file.txt" --doc_type text --update false
```


Example: Extract documentation from a local HTML file
```
waii database extract_doc --file "path/to/file.html" --doc_type html --update true
```


Options:
- `--file`: The URL of the web page or the path to the text file.
- `--doc_type`: The type of the documentation (only applies to `file`). It can be `html`, `text`. Default is `text`.
- `--url`: The URL of the web page. (Note that you can only use `--file` or `--url` at a time)
- `--update`: If set to `true`, the extracted documentation will be updated in the database. If set to `false`, the extracted documentation will be displayed in the console.
- `--tables`: The name of the tables where the documentation will be mapped to. By default we will search all the tables in the database.
- `--schemas`: The name of the schemas where the documentation will be mapped to. By default we will search all the schemas in the database.

---


## context

### `waii context list`

List all semantic context of the current database.

#### Options

| Option | Description |
|---------|-------------|
| `--limit` | How many statements to fetch |
| `--offset` | Which statement to start with |
| `--search` | Which string to search for in the statements |
| `--always_include` | Filter that decides which type of statement to fetch |
| `--format` | Choose the format of the response: text or json. |

---

### `waii context add`

Create a new semantic statement in the semantic context.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
|  | | |

#### Options

| Option | Description |
|---------|-------------|
| `--format` | choose the format of the response: text or json. |
| `--scope` | The scope of the statement: [[[[\<db\>].\<schema\>].\<table\>].\<column\>] |
| `--labels` | Comma separated list of labels for the statement: 'performance, finance' |
| `--always_include` | Whether the statement should be dynamically selected by query or always included. |
| `--lookup_summaries` | Comma separated list of summaries to use. |
| `--summarization_prompt` | Prompt to be used to extract information when the statement is used. |

---

### `waii context delete`

Delete a statement from the semantic context.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| uuid of the statement to be deleted. | | |

#### Options

| Option | Description |
|---------|-------------|
| `--format` | choose the format of the response: text or json. |

---

### `waii context import`

Import semantic statements in bulk. Duplicates will be ignored.

---

### `waii context delete_all`

Delete all added semantic contexts from the database

---


## schema

### `waii schema describe`

Get a generated description of a schema.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| schema_name - name of the schema to describe | | |

#### Options

| Option | Description |
|---------|-------------|
| `--format` | choose the format of the response: text or json |

#### Examples

Example: Describe a schema
```
waii schema describe RETAIL_DATA
```


```

Schema:
-------
TWEAKIT_PLAYGROUND.RETAIL_DATA

Description:
------------
The TWEAKIT_PLAYGROUND.RETAIL_DATA schema contains tables related to retail data analysis, including 
information about call centers, customers, addresses, demographics, dates, household demographics, 
income bands, inventory, items, promotions, reasons, stores, store returns, store sales, time 
dimensions, and warehouses.

Tables:
-------
┌────────────────────────┐
│ table                  │
├────────────────────────┤
│ PROMOTION              │
│ STORE_SALES            │
│ ITEM                   │

```


---

### `waii schema list`

Show all available schemas.

#### Options

| Option | Description |
|---------|-------------|
| `--format` | choose the format of the response: text or json. |

---

### `waii schema update`

Update the textual description of a schema.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| \<db\>.\<schema\> - name of the schema to change | | |
| description - description to use. | | |

---

### `waii schema update_questions`

Update the common questions stored for a schema.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| \<db\>.\<schema\> - name of the schema to change | | |
| questions - three individual questions to use. | | |

---

### `waii schema update_summary`

Update the textual summary of a schema.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| \<db\>.\<schema\> - name of the schema to change | | |
| description - description to use. | | |

---

### `waii schema migrate`

Create SQL statement that migrates all table of a schema from one database to another.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| \<db\>.\<schema\> - name of the schema to migrate | | |
| \<db\>.\<schema\> - destination schema. | | |

#### Options

| Option | Description |
|---------|-------------|
| `--source` | key of the source database, see 'waii database list' for options |
| `--destination` | key of the destination database. |

---


## table

### `waii table describe`

Show the details of a table.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| \<db\>.\<schema\>.\<table\> - table name of the table to describe. | | |

#### Options

| Option | Description |
|---------|-------------|
| `--format` | choose the format of the response: text or json. |

---

### `waii table list`

List all tables in the current database.

#### Options

| Option | Description |
|---------|-------------|
| `--format` | choose the format of the response: text or json |

#### Examples

Example: List all tables in the current database
```
waii table list
```


```

Output:
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ INFORMATION_SCHEMA                                                                   │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ ENABLED_ROLES                    TABLES                           COLUMNS            │
│ SEQUENCES                        VIEWS                            TABLE_PRIVILEGES   │
│ DATABASES                        REPLICATION_DATABASES            REPLICATION_GROUPS │
└──────────────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ RETAIL_DATA                                                                          │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ PROMOTION               STORE_SALES             ITEM                    STORE        │
│ DATE_DIM               HOUSEHOLD_DEMOGRAPHICS   TIME_DIM                CUSTOMER     │
└──────────────────────────────────────────────────────────────────────────────────────┘

```


---

### `waii table update`

Update the textual description of a table.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| \<db\>.\<schema\>.\<table\> - name of the table to change | | |
| description - description to use. | | |

---

### `waii table migrate`

Create SQL statement that migrates a table from one database to another.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| \<db\>.\<schema\>.\<table\> - name of the table to migrate | | |
| \<db\>.\<schema\> - destination schema. | | |

#### Options

| Option | Description |
|---------|-------------|
| `--source` | key of the source database, see 'waii database list' for options |
| `--destination` | key of the destination database. |

---

### `waii table ddl`

Convert from table definition to ddl

---


## history

### `waii history list`

Show the query history.

#### Options

| Option | Description |
|---------|-------------|
| `--format` | choose the format of the response: text or json. |
| `--limit` | choose how many items to list. |
| `--liked` | only display liked queries |

---


## user

### `waii user create_access_key`

Create a new access key for a user.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| name | string | The name of the access key to create. |

---

### `waii user list_access_keys`

List all access keys for the user.

---

### `waii user delete_access_key`

Delete specified access keys for the user.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| names | string[] | An array of strings denoting the names of the access keys to be deleted. |

---

### `waii user info`

Retrieve information about the user.

---

### `waii user update_config`

Update the user's configuration settings.

#### Options

| Option | Description |
|---------|-------------|
| `--key=value` | Specify key-value pairs to update in the configuration. |
| `--key=delete` | Specify keys to delete from the configuration. |

---

### `waii user create`

Create a new user.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| userId | string | The unique ID of the user to be created. |

#### Options

| Option | Description |
|---------|-------------|
| `--name` | The display name of the user. |
| `--tenant_id` | The tenant ID of the user. |
| `--org_id` | The organization ID of the user. |
| `--variables` | A JSON string representing the user's variables. |
| `--roles` | A comma-separated list of roles assigned to the user. |

---

### `waii user delete`

Delete an existing user.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| userId | string | The user ID of the user to be deleted. |

---

### `waii user update`

Update information about an existing user.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| userId | string | The unique ID of the user to be updated. |

#### Options

| Option | Description |
|---------|-------------|
| `--name` | The display name of the user. |
| `--tenant_id` | The tenant ID of the user. |
| `--org_id` | The organization ID of the user. |
| `--variables` | A JSON string representing the user's variables. |
| `--roles` | A comma-separated list of roles assigned to the user. |

---

### `waii user list`

Retrieve a list of users.

#### Options

| Option | Description |
|---------|-------------|
| `--lookup_org_id` | The organization ID for which the users are to be retrieved. |

---

### `waii user create_tenant`

Create a new tenant.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| tenantId | string | The unique ID of the tenant to be created. |

#### Options

| Option | Description |
|---------|-------------|
| `--name` | The display name of the tenant. |
| `--org_id` | The organization ID of the tenant. |
| `--variables` | A JSON string representing the tenant's variables. |

---

### `waii user update_tenant`

Update an existing tenant.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| tenantId | string | The unique ID of the tenant to be updated. |

#### Options

| Option | Description |
|---------|-------------|
| `--name` | The display name of the tenant. |
| `--org_id` | The organization ID of the tenant. |
| `--variables` | A JSON string representing the tenant's variables. |

---

### `waii user delete_tenant`

Delete an existing tenant.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| tenantId | string | The ID of the tenant to be deleted. |

---

### `waii user list_tenant`

Retrieve a list of tenants.

#### Options

| Option | Description |
|---------|-------------|
| `--lookup_org_id` | The organization ID for which the tenants are to be retrieved. |

---

### `waii user create_org`

Create a new organization.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| organizationId | string | The unique ID of the organization to be created. |

#### Options

| Option | Description |
|---------|-------------|
| `--name` | The display name of the organization. |
| `--variables` | A JSON string representing key-value pairs of organization variables. |

---

### `waii user update_org`

Update an existing organization.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| organizationId | string | The unique ID of the organization to be updated. |

#### Options

| Option | Description |
|---------|-------------|
| `--name` | The display name of the organization. |
| `--variables` | A JSON string representing key-value pairs of organization variables. |

---

### `waii user delete_org`

Delete an existing organization.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| organizationId | string | The unique ID of the organization to be deleted. |

---

### `waii user list_org`

List all organizations.

---


## semantic-layer

### `waii semantic-layer export`

Export semantic layer configuration for a database connection.

#### Options

| Option | Description |
|---------|-------------|
| `--db_conn_key` | Required. Database connection key |
| `--file` | Path to the output file. If not specified, prints to stdout. |
| `--format` | Output format: yaml (default) or json. |
| `--search_context` | Optional JSON string with search context parameters |
| `--poll_interval` | Interval in ms to poll for export status (default: 1000) |
| `--timeout` | Timeout in ms for export operation (default: 300 seconds) |
| `--max_retries` | Maximum number of retries when operation status returns 'not_exists' (default: 3). This can happen when the server has already processed and cleared the operation. |
| `--verbose` | Show verbose debug information and display neatly formatted statistics |

---

### `waii semantic-layer import`

Import semantic layer configuration for a database connection.

#### Options

| Option | Description |
|---------|-------------|
| `--db_conn_key` | Required. Database connection key |
| `--file` | Required. Path to the input file containing the configuration |
| `--format` | Input format: auto (default), yaml, or json |
| `--schema_mapping` | Optional JSON string with schema mapping |
| `--database_mapping` | Optional JSON string with database mapping |
| `--strict_mode` | Enable strict validation of the import configuration (default: false) |
| `--dry_run_mode` | Simulate the import without making actual changes and show detailed output (default: false) |
| `--detailed` | Show full JSON response from server |
| `--poll_interval` | Interval in ms to poll for import status (default: 1000) |
| `--timeout` | Timeout in ms for import operation (default: 5 minutes) |
| `--max_retries` | Maximum number of retries when operation status returns 'not_exists' (default: 5). |
| `--verbose` | Show verbose debug information and display detailed import statistics |

---


## docs

### `waii docs generate`

Generate CLI documentation

---

## Common Examples

```bash
waii database list
waii database list --format json
waii context list
waii context list --format json
waii schema describe schema_name
waii table describe schema_name.table_name
waii history
waii history list --format json
```

