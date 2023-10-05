# Waii-CLI Documentation

Waii-CLI is a powerful command-line interface (CLI) tool that generates SQL from plain text commands.

## Setup / Install Instructions

### Prerequisites:
- Node.js (version >= 16)

### Installation:

1. Make sure you have Node.js (version >= 16) installed.
   - You can check your Node.js version by running `node -v` in the terminal.
   - If you don't have Node.js installed, you can download it from [Node.js official website](https://nodejs.org/).

2. Install Waii-CLI globally using npm:

```bash
npm install -g waii-cli
```
3. Set your API key.

Login to https://tweakit.waii.ai/, you need to get username/password to access it first. Go to Settings -> Copy API Key to get your API key.

Create ~/.waii/yaml.conf on your local laptop and add your api key.
```yaml
url: https://tweakit.waii.ai/api/
apiKey: <your-api-key>
```

4. Test it:

Run
```
waii database describe
```
You should be able to see the content from Waii playground database:
```
┌──────────┐
│ database │
├──────────┤
│ WAII     │
└──────────┘
┌─────────────────────────┬────────┐
│ schema                  │ tables │
├─────────────────────────┼────────┤
│ WAII.INFORMATION_SCHEMA │ 31     │
│ WAII.CINE_TELE_DATA     │ 3      │
└─────────────────────────┴────────┘
```

### Commands and Subcommands

#### query:
- create: Generates a SQL statement from a natural question or statement.
- update: Updates a SQL statement with instructions given in natural language.
- explain: Provides a detailed natural language breakdown of a given SQL query.
- describe: Describes the structure of a specific query.
- rewrite: Modifies an existing SQL query based on best practices.
- transcode: Transforms a given query to another SQL dialect.
- diff: Compares two SQL queries and highlights the differences.
- run: Executes the generated SQL query.

#### database:
- list: Displays a list of available databases.
- add: Lets you add a new database.
- delete: Delete a database connection.
- activate: Sets a specific database as the active working database.
- describe: Describes the structure and metadata of a specified database.

#### context:
- list: Lists the current semantic context.
- add: Adds a new statement to the semantic context.
- delete: Removes a statement from the semantic context.

#### history:
- list: Displays a list of recent SQL commands and queries.

## Examples

### Query related

#### Generate Query

```bash
waii query create "How many columns for each table in the database? Include table name and schema name"
```
![screenshots/cli_output_1.png](screenshots/cli_output_1.png)

```bash
waii query create "Find customers whose increase in spend from the first month of the year to the last month of the year has increased more in 2001 than in 2000."
```
![screenshots/cli_output_2.png](screenshots/cli_output_2.png)

#### Run Query

You can create a query then run it
```bash
waii query create "How many columns for each table in the database? Include table name and schema name" | waii query run
```

Output:
```
➜  waii-cli git:(main) ✗ waii query create "How many columns for each table in the database? \
                         Include table name and schema name" | waii query run
┌────────────────────┬─────────────────────────────────┬─────────────┐
│ TABLE_SCHEMA       │ TABLE_NAME                      │ NUM_COLUMNS │
├────────────────────┼─────────────────────────────────┼─────────────┤
│ CRUNCHBASE_2016    │ ADDITIONS                       │ 4           │
│ RETAIL_DATA        │ PROMOTION                       │ 19          │
│ PLAYGROUND         │ TEST_TABLE                      │ 1           │
│ INFORMATION_SCHEMA │ REPLICATION_GROUPS              │ 18          │
│ INFORMATION_SCHEMA │ ENABLED_ROLES                   │ 2           │
│ INFORMATION_SCHEMA │ TABLE_CONSTRAINTS               │ 14          │
...
```

You can directly run a query
```bash
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

Output:
```
┌───────────────────────────────────────┬─────────────────────┐
│ COUNTRY_NAME                          │ AVG_CITY_POPULATION │
├───────────────────────────────────────┼─────────────────────┤
│ Afghanistan                           │ 583025              │
│ Netherlands                           │ 185001.75           │
│ Netherlands Antilles                  │ 2345                │
│ Albania                               │ 270000              │
│ Algeria                               │ 288454.388889       │
│ American Samoa                        │ 3761.5              │
│ Andorra                               │ 21189               │
│ Angola                                │ 512320              │
│ Antigua and Barbuda                   │ 24000               │
....
```

#### Describe a query
You can use this query as an example: [my-complex-query.sql](doc/examples/my-complex-query.sql)

```bash
cat my-complex-query.sql | waii query describe
```

Output:
```
Summary:
--------
What is the percentage of the population that speaks the official language in each country?

Tables:
-------
WORLD.CITY
WORLD.COUNTRY
WORLD.COUNTRYLANGUAGE

Steps:
------
Step 1: Calculate the total population for each country by summing the population of all cities in that country.

Step 2: Calculate the population of people who speak the official language in each country by multiplying the 
        population of each city by the percentage of people who speak the official language.

...
```

#### Transcode a query (Translate a query to another SQL dialect)
You can use this query as an example: [pyspark.sql](doc/examples/pyspark.sql)

Run the following command to transcode the PySpark query to Snowflake SQL:
```bash
cat pyspark.sql | waii query transcode -from pyspark -to snowflake
```

Output:
```
WITH joined_data AS (
    SELECT
        s.s_store_name,
        s.s_store_id,
        d.d_day_name,
        ss.ss_sales_price
    FROM tweakit_playground.retail_data.date_dim AS d
    INNER JOIN tweakit_playground.retail_data.store_sales AS ss
        ON d.d_date_sk = ss.ss_sold_date_sk
    INNER JOIN tweakit_playground.retail_data.store AS s
        ON s.s_store_sk = ss.ss_store_sk AND s.s_gmt_offset = -5
    WHERE
        d.d_year = 2000
)

SELECT
    s_store_name,
    s_store_id,
    
    ...
```

### Database related

#### List databases
```bash
waii database list
```

```
┌──────────────────┬────────────────────┬────────────┬───────────────────┬──────────────┐
│ account_name     │ database           │ warehouse  │ role              │ username     │
├──────────────────┼────────────────────┼────────────┼───────────────────┼──────────────┤
│ gq.........91428 │ TWEAKIT_PLAYGROUND │ COMPUTE_WH │ TWEAKIT_USER_ROLE │ TWEAKIT_USER │
└──────────────────┴────────────────────┴────────────┴───────────────────┴──────────────┘
```

#### Activate database

Waii CLI uses the active database to generate queries, get table information, etc. You can switch the active database by running the following command (URL can be found by running `waii database list`):
```bash
database activate <url_of_the_database>
```

### Table and Schema related

#### List your tables (under the current database)
```bash
waii table list
```

Output
```
➜  waii-cli git:(main) ✗ waii table list
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ INFORMATION_SCHEMA                                                                                                                   │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ENABLED_ROLES                    TABLES                           COLUMNS                          SCHEMATA                          │
│ SEQUENCES                        VIEWS                            TABLE_PRIVILEGES                 USAGE_PRIVILEGES                  │
│ DATABASES                        REPLICATION_DATABASES            REPLICATION_GROUPS               FUNCTIONS                         │
│ PROCEDURES                       OBJECT_PRIVILEGES                FILE_FORMATS                     APPLICABLE_ROLES                  │
│ STAGES                           REFERENTIAL_CONSTRAINTS          TABLE_CONSTRAINTS                INFORMATION_SCHEMA_CATALOG_NAME   │
│ LOAD_HISTORY                     TABLE_STORAGE_METRICS            PIPES                            EXTERNAL_TABLES                   │
│ EVENT_TABLES                     PACKAGES                         STREAMLITS                       CLASS_INSTANCE_FUNCTIONS          │
│ CLASSES                          CLASS_INSTANCES                  CLASS_INSTANCE_PROCEDURES                                          │
│                                                                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ RETAIL_DATA                                                                                                              │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ PROMOTION               STORE_SALES             ITEM                    STORE                   INVENTORY                │
│ DATE_DIM                HOUSEHOLD_DEMOGRAPHICS  TIME_DIM                CUSTOMER_ADDRESS        CUSTOMER                 │
│ CUSTOMER_DEMOGRAPHICS   CALL_CENTER             STORE_RETURNS           WAREHOUSE               INCOME_BAND              │
│ REASON                                                                                                                   │
│                                                                                                                          │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Describe a schema (Get generated description of a schema)
```bash
waii schema describe RETAIL_DATA
```

Output:
```
Schema:
-------
TWEAKIT_PLAYGROUND.RETAIL_DATA

Description:
------------
The TWEAKIT_PLAYGROUND.RETAIL_DATA schema contains tables related to retail data analysis, including information about 
call centers, customers, addresses, demographics, dates, household demographics, income bands, inventory, items, 
promotions, reasons, stores, store returns, store sales, time dimensions, and warehouses. This schema can be used to 
analyze various aspects of retail operations, such as call center performance, customer demographics, inventory 
management, sales trends, and promotional effectiveness.

Tables:
-------
┌────────────────────────┐
│ table                  │
├────────────────────────┤
│ PROMOTION              │
│ STORE_SALES            │
│ ITEM                   │

Common Questions:
-----------------
What is the average number of employees in each call center?
How many customers are there in each country?
What is the average price of items in each category?
...
```

#### Get history of generated queries
```bash
waii history list
```

Output
```
┌──────────┬──────────────────────────────────────────────────────────────┐
│ property │ value                                                        │
├──────────┼──────────────────────────────────────────────────────────────┤
│ uuid     │ 6d58f192-b0d4-4672-9b57-f2652ba8268d                         │
├──────────┼──────────────────────────────────────────────────────────────┤
│ favorite │ false                                                        │
├──────────┼──────────────────────────────────────────────────────────────┤
│ question │ What is the average number of employees in each call center? │
├──────────┼──────────────────────────────────────────────────────────────┤
│ tables   │ RETAIL_DATA.CALL_CENTER                                      │
└──────────┴──────────────────────────────────────────────────────────────┘
Query:
---
SELECT
cc_call_center_id,
AVG(cc_employees) AS avg_employees
FROM tweakit_playground.retail_data.call_center
GROUP BY
cc_call_center_id
------------------------------------------------------------
<...More Generated Queries ...>
```
