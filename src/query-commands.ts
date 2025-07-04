/**
 * Copyright 2023–2025 Waii, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


import WAII from 'waii-sdk-js';
import { ArgumentError, CmdParams } from './cmd-line-parser';
import { js_beautify } from 'js-beautify';
import { Table } from 'console-table-printer';
import { TableName, SchemaName } from 'waii-sdk-js/dist/clients/database/src/Database';
import { highlight } from 'cli-highlight';

export interface IIndexable {
    [key: string]: unknown;
}

const printQuery = (query: string | undefined) => {
    if (!query) {
        return;
    }
    const highlight = require('cli-highlight').highlight;
    console.log(highlight(query, { language: 'sql', ignoreIllegals: true }));
};

const queryCreateDoc = {
    description: 'Generate a query from text. Pass a question or instructions and receive the query in response.',
    parameters: ['ask - a question or set of instructions to generate the query.'],
    stdin: 'If there is no argument to the command, stdin will be interpreted as the question, instructions.',
    options: {
        format: 'choose the format of the response: text or json',
        dialect: 'choose the database backend: snowflake or postgres'
    },
    examples: `Example 1: Generate a query to count columns
<code>waii query create "How many columns for each table in the database? Include table name and schema name"</code>

<code>
SELECT 
    table_schema,
    table_name,
    COUNT(*) as num_columns
FROM information_schema.columns
GROUP BY table_schema, table_name
ORDER BY table_schema, table_name;
</code>

Example 2: Find customer spending patterns
<code>waii query create "Find customers whose increase in spend from the first month of the year to the last month of the year has increased more in 2001 than in 2000."</code>

<code>
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
</code>`
};

const queryCreate = async (params: CmdParams) => {
    const dialect = params.opts['dialect'];
    let ask = params.vals[0];

    if (!ask) {
        ask = params.input;
    }

    const result = await WAII.Query.generate({ ask: ask, dialect: dialect });
    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        default: {
            printQuery(result.query);
        }
    }
};

const queryUpdateDoc = {
    description: 'Update a query from text. Pass a question or instructions and receive the query in response.',
    parameters: ['instructions - a set of instructions to update the query.'],
    stdin: 'The query to update',
    options: {
        format: 'choose the format of the response: text or json.',
        dialect: 'choose the database backend: snowflake or postgres.',
        schema: 'optional schema name that the query uses.'
    }
};
const queryUpdate = async (params: CmdParams) => {
    const query = params.input;
    const dialect = params.opts['dialect'];
    const schema = params.opts['schema'];

    if (!query) {
        throw new ArgumentError('No query specified.');
    }

    const descResult = await WAII.Query.describe({ query: query });
    const genResult = await WAII.Query.generate({
        ask: params.vals[0],
        dialect: dialect,
        tweak_history: [{ ask: descResult.summary, sql: query }],
        search_context: [{ schema_name: schema }]
    });
    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(genResult, null, 2));
            break;
        }
        default: {
            printQuery(genResult.query);
        }
    }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log_query_explain_result = (result: any) => {
    if (result.what_changed) {
        console.log('What Changed: \n--------------');
        console.log(result.what_changed);
        console.log('\n');
    }

    console.log('Summary: \n--------');
    console.log(result.summary);

    const tables = (result.tables ? result.tables : []).map((tname: TableName) => {
        return tname.schema_name + '.' + tname.table_name;
    }).join('\n');
    if (tables) {
        console.log('\nTables: \n-------');
        console.log(tables);
    }

    console.log('\nSteps: \n------');
    console.log((result.detailed_steps ? result.detailed_steps : []).join('\n\n'));
};

const queryExplainDoc = {
    description: 'Explain a query.',
    parameters: ['query - the query to explain'],
    stdin: 'If there is no query in the arguments, query is read from stdin.',
    options: {
        format: 'choose the format of the response: text or json.'
    },
    examples: `Example: Describe a complex query
<code>cat my-complex-query.sql | waii query describe</code>

<code>
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
</code>`
};
const queryExplain = async (params: CmdParams) => {
    const query = params.input;
    const result = await WAII.Query.describe({ query: query });
    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        default: {
            log_query_explain_result(result);
        }
    }
};

const queryDiffDoc = {
    description: 'Compare two queries and explain the differences.',
    parameters: ['qf_1: the first query', 'qf_2: the second query'],
    stdin: 'qf_1 can be optionally read from stin',
    options: {
        format: 'choose the format of the response: text or json.',
        dialect: 'choose the database backend: snowflake or postgres.',
        qf_1: 'filename of a file containing the first query',
        qf_2: 'filename of a file containing the second query'
    }
};
const queryDiff = async (params: CmdParams) => {
    let query = '';
    const qf_1 = params.opts['qf_1'];
    const qf_2 = params.opts['qf_2'];
    let prev_query = '';

    if (!qf_1) {
        prev_query = params.input;
    } else {
        const fs = require('fs');
        prev_query = fs.readFileSync(qf_1, 'utf8');
    }

    if (!prev_query) {
        throw new ArgumentError('Could not find first query.');
    }

    if (qf_2) {
        const fs = require('fs');
        query = fs.readFileSync(qf_2, 'utf8');
    }

    if (!query) {
        throw new ArgumentError('Could not find second query.');
    }

    const result = await WAII.Query.diff({ query: query, previous_query: prev_query });
    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        default: {
            log_query_explain_result(result);
        }
    }
};

const queryRewriteDoc = {
    description: 'Rewrite the query in a more readable and performant way.',
    parameters: [],
    stdin: 'The query to rewrite',
    options: {
        format: 'choose the format of the response: text or json',
        dialect: 'choose the database backend: snowflake or postgres'
    }
};
const queryRewrite = async (params: CmdParams) => {
    params.vals[0] = 'Rewrite the query to proudce the same output in a more readable and performant way.';
    await queryUpdate(params);
};

const generateQuestionDoc = {
    description: 'Generate questions based on the database schema.',
    parameters: [],
    options: {
        schema: 'Name of the schema to generate questions for.',
        complexity: 'Complexity of the questions to generate: easy, medium, hard',
        n_questions: 'Number of questions to generate',
        format: 'choose the format of the response: text or json'
    }
};
const generateQuestion = async (params: CmdParams) => {
    // n questions will be 5 by default
    let n_questions = 5;
    if (params.opts['n_questions']) {
        n_questions = parseInt(params.opts['n_questions']);
    }

    // complex will be medium by default
    // let complexity = 'medium';
    // if (params.opts['complexity']) {
    //     complexity = params.opts['complexity'];
    // }

    // you mush provide a schema
    if (!params.opts['schema']) {
        throw new ArgumentError('You must provide a schema to generate questions for.');
    }

    WAII.Query.generateQuestion({
        schema_name: params.opts['schema'],
        n_questions: n_questions,
        complexity: params.opts['complexity']
    }).then((result) => {
        if (params.opts['format'] === 'json') {
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log('Questions: ');
            console.log('----------');
            for (let i = 0; !(result.questions) || i < result.questions.length; i++) {
                if (result.questions) {
                    console.log(result.questions[i].question + '\n');
                }
            }
        }
    });
};

const queryTranscodeDoc = {
    description: 'Translate queries from one dialect to another, if multiple queries are provided, they will be converted one by one.',
    parameters: ['ask - you can specify additional instructions to translate the query, such as \'use the test schema for converted query\''],
    stdin: 'The query to translate.',
    options: {
        format: 'choose the format of the response: text or json',
        from: 'choose the database backend to translate from: snowflake or postgres',
        to: 'choose the database backend to translate to: snowflake or postgres',
        split_queries: 'split the input into multiple queries and convert them one by one. Default is true.'
    },
    examples: `Example: Convert PySpark query to Snowflake SQL
<code>cat pyspark.sql | waii query transcode -from pyspark -to snowflake</code>`
};
const queryTranscode = async (params: CmdParams) => {
    const from_dialect = params.opts['from'];
    const to_dialect = params.opts['to'] ? params.opts['to'] : 'Snowflake';
    params.opts['dialect'] = to_dialect;
    const split_multi_query = params.opts['split_queries'] ? params.opts['split_queries'] === 'true' : true;
    let sqls = [];
    if (split_multi_query) {
        sqls = await getAllSqlQueriesFromStr(params.input);
    } else {
        sqls = await removeSqlCommentsFromStr(params.input);
    }
    for (let i = 0; i < sqls.length; i++) {
        params.input = sqls[i];

        const genResult = await WAII.Query.transcode({
            ask: params.vals[0] ? params.vals[0] : '',
            target_dialect: to_dialect,
            source_dialect: from_dialect,
            source_query: params.input
        });
        if (i < sqls.length - 1) {
            console.log('--\n');
        }
        printQuery(genResult.query);
    }
};

const removeSqlCommentsFromStr = async (input: string) => {
        // Remove lines that start with --
        const cleanedInput = input.split('\n')
            .filter(line => !line.trim().startsWith('--'))
            .join('\n');

        return [cleanedInput];
};

const getAllSqlQueriesFromStr = async (input: string) => {
        // Remove lines that start with --
        const cleanedInput = input.split('\n')
            .filter(line => !line.trim().startsWith('--'))
            .join('\n');

        // Split input by semicolon
        const potentialQueries = cleanedInput.split(';');

        // Filter and process each SQL
        const result = potentialQueries
            .map(sql => sql.trim())
            .filter(sql => sql.length > 0);  // Remove empty or whitespace-only queries

        return result;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const printPrettyConsole = (str: any) => {
    try {
        const beautifulJavaScript = js_beautify(str, {
            indent_size: 2,      // Number of spaces for indentation
            space_in_empty_paren: true
        });
        console.log(highlight(beautifulJavaScript, { language: 'javascript', ignoreIllegals: true }));
    } catch (e) {
        console.log(str);
    }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sanitizeData = (rowName: string, columnValue: any) => {
    let d;
    if (rowName.toUpperCase().startsWith('DATE')) {
      d = new Date((new Date()).getTimezoneOffset() * 60000);
      d.setUTCSeconds(columnValue / 1000);
      return d.toDateString();
    } else if (rowName.startsWith('times')) {
      d = new Date(0);
      d.setUTCSeconds(columnValue / 1000);
      return d.toLocaleString();
    } else {
      return String(columnValue);
    }

};

const queryRunDoc = {
    description: 'Execute the query and return the results',
    parameters: ['query - you can specify the query to run as a parameter.'],
    stdin: 'If no parameters are specified, the query to be run will be read from stdin.',
    options: {
        format: 'choose the format of the response: text or json',
        schema: 'use the schema given as the schema for the query. format: <db>.<schema>'
    },
    examples: `Example: Run a complex query
<code>cat <<EOF | waii query run
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
EOF</code>

<code>
┌─────────────────┬────────────────────┐
│ country_name    │ avg_city_population│
├─────────────────┼────────────────────┤
│ United States   │ 286,955            │
│ China           │ 842,233            │
│ India           │ 534,489            │
└─────────────────┴────────────────────┘
</code>`
};
const queryRun = async (params: CmdParams) => {
    let query = '';
    if (params.vals.length < 1 || !params.vals[0]) {
        query = params.input;
    } else {
        query = params.vals[0];
    }

    if (!query) {
        throw new ArgumentError('No query specified.');
    }

    let schema: SchemaName | null = null;
    const name = params.opts['schema'];
    if (name) {
        const parts = name.split('.');
        if (parts.length !== 2) {
            throw new ArgumentError('Schema name must be <db>.<schema>');
        }
        schema = {
            schema_name: parts[1],
            database_name: parts[0]
        };
    }

    const connection = await WAII.Database.getConnections();
    const result = await WAII.Query.run({ query: query, ...(schema && {current_schema: schema})});
    switch (params.opts['format']) {
        case 'json': {
            printPrettyConsole(result);
            break;
        }
        default: {
            if (result.column_definitions && result.rows) {
                if (connection.default_db_connection_key?.includes('mongodb://') ||
                    connection.default_db_connection_key?.includes('mongodb+srv://')) {
                    printPrettyConsole((result.rows[0] as { [key: string]: unknown })['DOC']);
                    return;
                } else {
                    // Define the columns based on the result's column definitions
                    const columns = result.column_definitions.map((c) => {
                        return { name: c.name, alignment: 'left' };
                    });

                    if (columns.length === 0) {
                        console.log('Statement succeeded.');
                    } else {
                        // Create a new Table with the columns
                        const p = new Table({ columns });

                        // Iterate through the rows and add them to the table
                        for (const row of result.rows) {
                            const rowObj: { [key: string]: unknown } = {};
                            for (const column of result.column_definitions) {
                                // @ts-ignore
                                const value = row[column.name];
                                rowObj[column.name] = sanitizeData(column.type, value);
                            }
                            p.addRow(rowObj);
                        }

                        // Print the table
                        p.printTable();
                    }
                }
            }
        }
    }
};

const queryAnalyzeDoc = {
    description: 'Analyze query performance.',
    parameters: ['query - you can specify the query to run and analyze as a parameter.'],
    stdin: 'If no parameters are specified, the query to be analyzed will be read from stdin.',
    options: {
        format: 'choose the format of the response: text or json',
        query: 'You can specify the query to run and analyze as an option as well',
        query_id: 'You can specify a query that ran already and get performance insights.',
        summary: 'Print the performance analysis summary.',
        recommendations: 'Print recommendations on how to improve the query.',
        query_text: 'Print query (useful when you\'re using query_id)',
        times: 'Print the query execution and compile time.'
    }
};
const queryAnalyze = async (params: CmdParams) => {
    let query = '';
    if (params.vals.length < 1 || !params.vals[0]) {
        query = params.input;
    } else {
        query = params.vals[0];
    }

    if (params.opts['query']) {
        query = params.opts['query'];
    }

    let queryId = params.opts['query_id'];
    const printSummary = 'summary' in params.opts;
    const printRecommendation = 'recommendation' in params.opts;
    const printQueryText = 'query_text' in params.opts;
    const printTimes = 'times' in params.opts;
    const printAll = !(printSummary || printRecommendation || printQueryText || printTimes);

    if (!query && !queryId) {
        throw new ArgumentError('No query or query_id specified.');
    }

    if (!queryId) {
        const result = await WAII.Query.submit({query: query});
        if (!result.query_id) {
            throw new ArgumentError('Unable to retrieve query id from running query.');
        }
        queryId = result.query_id;
        // don't need the result but need to wait for the query to finish.
        WAII.Query.getResults({query_id: queryId});
    }

    const result = await WAII.Query.analyzePerformance({query_id: queryId});

    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        default: {

            if (printQueryText || printAll) {
                if (printAll) {
                    console.log('Query:');
                    console.log('---');
                }

                printQuery(result.query_text);

                if (printAll) {
                    console.log();
                }
            }

            if (result.execution_time_ms !== undefined && result.compilation_time_ms !== undefined) {
                if (!printTimes) {
                    console.log();
                    console.log('Times:');
                    console.log('---');
                    console.log();
                }
                console.log(`Compile time: ${result.compilation_time_ms} ms, execution time: ${result.execution_time_ms} ms\n`);

                if (!printTimes) {
                    console.log();
                }
            }

            if (printSummary || printAll) {
                if (!printSummary) {
                    console.log();
                    console.log('Summary:');
                    console.log('---');
                    console.log();
                }

                for (const msg of result.summary) {
                    console.log(msg);
                    console.log();
                }

                if (!printSummary) {
                    console.log();
                }
            }

            if (printRecommendation || printAll) {
                if (!printRecommendation) {
                    console.log('Recommendations:');
                    console.log('---');
                    console.log();
                }
                for (const msg of result.recommendations) {
                    console.log(msg);
                    console.log();
                }
                if (!printRecommendation) {
                    console.log();
                }
            }
            break;
        }
    }
};

const queryCommands = {
    create: { fn: queryCreate, doc: queryCreateDoc },
    update: { fn: queryUpdate, doc: queryUpdateDoc },
    explain: { fn: queryExplain, doc: queryExplainDoc },
    describe: { fn: queryExplain, doc: queryDiffDoc },
    rewrite: { fn: queryRewrite, doc: queryRewriteDoc },
    transcode: { fn: queryTranscode, doc: queryTranscodeDoc },
    diff: { fn: queryDiff, doc: queryDiffDoc },
    run: { fn: queryRun, doc: queryRunDoc },
    analyze: {fn: queryAnalyze, doc: queryAnalyzeDoc},
    generate_question: {fn: generateQuestion, doc: generateQuestionDoc}
};

export { queryCommands, printQuery };
