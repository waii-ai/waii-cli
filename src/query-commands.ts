import WAII from 'waii-sdk-js'
import { ArgumentError, CmdParams } from './cmd-line-parser';
import { js_beautify } from 'js-beautify';
import { Table } from 'console-table-printer';
import { TableName, SchemaName } from "waii-sdk-js/dist/clients/database/src/Database";
import { highlight } from "cli-highlight";

export interface IIndexable {
    [key: string]: any;
}

const printQuery = (query: string | undefined) => {
    if (!query) {
        return;
    }
    const highlight = require('cli-highlight').highlight
    console.log(highlight(query, { language: 'sql', ignoreIllegals: true }))
}

const queryCreateDoc = {
    description: "Generate a query from text. Pass a question or instructions and receive the query in response.",
    parameters: ["ask - a question or set of instructions to generate the query."],
    stdin: "If there is no argument to the command, stdin will be interpreted as the question, instructions.",
    options: {
        format: "choose the format of the response: text or json",
        dialect: "choose the database backend: snowflake or postgres"
    }
};

const queryCreate = async (params: CmdParams) => {
    let dialect = params.opts['dialect']
    let ask = params.vals[0];

    if (!ask) {
        ask = params.input;
    }

    let result = await WAII.Query.generate({ ask: ask, dialect: dialect });
    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        default: {
            printQuery(result.query);
        }
    }
}

const queryUpdateDoc = {
    description: "Update a query from text. Pass a question or instructions and receive the query in response.",
    parameters: ["instructions - a set of instructions to update the query."],
    stdin: "The query to update",
    options: {
        format: "choose the format of the response: text or json.",
        dialect: "choose the database backend: snowflake or postgres.",
        schema: "optional schema name that the query uses."
    }
};
const queryUpdate = async (params: CmdParams) => {
    let query = params.input;
    let dialect = params.opts['dialect']
    let schema = params.opts['schema']

    if (!query) {
        throw new ArgumentError("No query specified.");
    }

    let descResult = await WAII.Query.describe({ query: query });
    let genResult = await WAII.Query.generate({
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
}

const log_query_explain_result = (result: any) => {
    if (result.what_changed) {
        console.log("What Changed: \n--------------");
        console.log(result.what_changed);
        console.log("\n")
    }

    console.log("Summary: \n--------");
    console.log(result.summary);

    let tables = (result.tables ? result.tables : []).map((tname: TableName) => {
        return tname.schema_name + "." + tname.table_name;
    }).join('\n');
    if (tables) {
        console.log("\nTables: \n-------");
        console.log(tables);
    }

    console.log("\nSteps: \n------");
    console.log((result.detailed_steps ? result.detailed_steps : []).join('\n\n'));
}

const queryExplainDoc = {
    description: "Explain a query.",
    parameters: ["query - the query to explain"],
    stdin: "If there is no query in the arguments, query is read from stdin.",
    options: {
        format: "choose the format of the response: text or json.",
    }
};
const queryExplain = async (params: CmdParams) => {
    let query = params.input;
    let result = await WAII.Query.describe({ query: query });
    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        default: {
            log_query_explain_result(result);
        }
    }
}

const queryDiffDoc = {
    description: "Compare two queries and explain the differences.",
    parameters: ["qf_1: the first query", "qf_2: the second query"],
    stdin: "qf_1 can be optionally read from stin",
    options: {
        format: "choose the format of the response: text or json.",
        dialect: "choose the database backend: snowflake or postgres.",
        qf_1: "filename of a file containing the first query",
        qf_2: "filename of a file containing the second query"
    }
};
const queryDiff = async (params: CmdParams) => {
    let query = "";
    let qf_1 = params.opts['qf_1'];
    let qf_2 = params.opts['qf_2'];
    let prev_query = ""

    if (!qf_1) {
        prev_query = params.input;
    } else {
        let fs = require('fs');
        prev_query = fs.readFileSync(qf_1, 'utf8');
    }

    if (!prev_query) {
        throw new ArgumentError("Could not find first query.");
    }

    if (qf_2) {
        let fs = require('fs');
        query = fs.readFileSync(qf_2, 'utf8');
    }

    if (!query) {
        throw new ArgumentError("Could not find second query.");
    }

    let result = await WAII.Query.diff({ query: query, previous_query: prev_query });
    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        default: {
            log_query_explain_result(result);
        }
    }
}

const queryRewriteDoc = {
    description: "Rewrite the query in a more readable and performant way.",
    parameters: [],
    stdin: "The query to rewrite",
    options: {
        format: "choose the format of the response: text or json",
        dialect: "choose the database backend: snowflake or postgres"
    }
};
const queryRewrite = async (params: CmdParams) => {
    params.vals[0] = "Rewrite the query to proudce the same output in a more readable and performant way.";
    await queryUpdate(params);
}

const queryTranscodeDoc = {
    description: "Translate a query from one dialect to another.",
    parameters: [""],
    stdin: "The query to translate.",
    options: {
        format: "choose the format of the response: text or json",
        from: "choose the database backend to translate from: snowflake or postgres",
        to: "choose the database backend to translate to: snowflake or postgres"
    }
};
const queryTranscode = async (params: CmdParams) => {
    let from_dialect = params.opts['from']
    let to_dialect = params.opts['to'] ? params.opts['to'] : 'Snowflake';
    params.opts['dialect'] = to_dialect;
    let msg = "Rewrite the query to produce the same output in " + to_dialect
    if (from_dialect) {
        msg += " from " + from_dialect;
    }

    params.vals[0] = msg
    await queryUpdate(params);
}

const printPrettyConsole = (str: any) => {
    try {
        const beautifulJavaScript = js_beautify(str, {
            indent_size: 2,      // Number of spaces for indentation
            space_in_empty_paren: true
        });
        console.log(highlight(beautifulJavaScript, { language: 'javascript', ignoreIllegals: true }))
    } catch (e) {
        console.log(str)
    }
}

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
  
}

const queryRunDoc = {
    description: "Execute the query and return the results",
    parameters: ["query - you can specify the query to run as a parameter."],
    stdin: "If no parameters are specified, the query to run will be read from stdin.",
    options: {
        format: "choose the format of the response: text or json",
        schema: "use the schema given as the schema for the query. format: <db>.<schema>"
    }
};
const queryRun = async (params: CmdParams) => {
    let query = "";
    if (params.vals.length < 1 || !params.vals[0]) {
        query = params.input;
    } else {
        query = params.vals[0];
    }

    if (!query) {
        throw new ArgumentError("No query specified.");
    }

    let schema: SchemaName | null = null;
    let name = params.opts['schema'];
    if (name) {
        let parts = name.split('.');
        if (parts.length !== 2) {
            throw new ArgumentError("Schema name must be <db>.<schema>");
        }
        schema = {
            schema_name: parts[1],
            database_name: parts[0]
        };
    }

    const connection = await WAII.Database.getConnections();
    let result = await WAII.Query.run({ query: query, ...(schema && {current_schema: schema})});
    switch (params.opts['format']) {
        case 'json': {
            printPrettyConsole(result);
            break;
        }
        default: {
            if (result.column_definitions && result.rows) {
                if (connection.default_db_connection_key?.includes('mongodb://') ||
                    connection.default_db_connection_key?.includes('mongodb+srv://')) {
                    printPrettyConsole((result.rows[0] as { [key: string]: any })['DOC']);
                    return;
                } else {
                    // Define the columns based on the result's column definitions
                    const columns = result.column_definitions.map((c) => {
                        return { name: c.name, alignment: 'left' }; // you can customize alignment here
                    });

                    // Create a new Table with the columns
                    const p = new Table({ columns });

                    // Iterate through the rows and add them to the table
                    for (const row of result.rows) {
                        const rowObj: { [key: string]: any } = {};
                        for (const column of result.column_definitions) {
                            // @ts-ignore
                            const value = row[column.name];
                            rowObj[column.name] = sanitizeData(column.type, value)
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

const queryAnalyzeDoc = {
    description: "Analyze query performance.",
    parameters: ["query - you can specify the query to run and analyze as a parameter."],
    stdin: "If no parameters are specified, the query to be analyzed will be read from stdin.",
    options: {
        format: "choose the format of the response: text or json",
        query: "You can specify the query to run and analyze as an option as well",
        query_id: "You can specify a query that ran already and get performance insights.",
        summary: "Print the performance analysis summary.",
        recommendations: "Print recommendations on how to improve the query."
    }
};
const queryAnalyze = async (params: CmdParams) => {
    let query = "";
    if (params.vals.length < 1 || !params.vals[0]) {
        query = params.input;
    } else {
        query = params.vals[0];
    }

    if (params.opts['query']) {
        query = params.opts['query'];
    }

    let queryId = params.opts['query_id'];
    let printSummary = 'summary' in params.opts;
    let printRecommendation = 'recommendation' in params.opts;

    console.log(printSummary, printRecommendation);

    if (!query && !queryId) {
        throw new ArgumentError("No query or query_id specified.");
    }

    if (!queryId) {
        let result = await WAII.Query.submit({query: query});
        if (!result.query_id) {
            throw new ArgumentError("Unable to retrieve query id from running query.");
        }
        queryId = result.query_id;
        // don't need the result but need to wait for the query to finish.
        WAII.Query.getResults({query_id: queryId});
    }

    let result = await WAII.Query.analyzePerformance({query_id: queryId});

    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        default: {
            console.log('Query:');
            console.log('---');
            printQuery(result.query_text)
            console.log();

            if (printSummary || !printRecommendation) {
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
            
            if (printRecommendation || !printSummary) {
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
    analyze: {fn: queryAnalyze, doc: queryAnalyzeDoc} 
};

export { queryCommands, printQuery }
