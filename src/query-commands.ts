import WAII from 'waii-sdk-js'
import {CmdParams} from './cmd-line-parser';

export interface IIndexable {
    [key: string]: any;
}

const printQuery = (query: string | undefined) => {
    if (!query) {
        return;
    }
    const highlight = require('cli-highlight').highlight
    console.log(highlight(query, {language: 'sql', ignoreIllegals: true}))
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

    let result = await WAII.Query.generate({ask: ask, dialect: dialect});
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

    let descResult = await WAII.Query.describe({query: query});
    let genResult = await WAII.Query.generate({
        ask: params.vals[0],
        dialect: dialect,
        tweak_history: [{ask: descResult.summary, sql: query}],
        search_context: [{schema_name: schema}]
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

    let tables = (result.tables ? result.tables : []).map((tname : TableName) => {
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
    let result = await WAII.Query.describe({query: query});
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
    
    if(!prev_query) {
        console.error("Could not find first query.");
        process.exit(-1);
    }

    if (qf_2) {
        let fs = require('fs');
        query = fs.readFileSync(qf_2, 'utf8');
    }

    if (!query) {
        console.error("Could not find second query.");
        process.exit(-1);
    }

    let result = await WAII.Query.diff({query: query, previous_query: prev_query});
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
        msg += " to " + from_dialect;
    }

    params.vals[0] = msg
    await queryUpdate(params);
}

import {Table} from 'console-table-printer';
import {TableName} from "waii-sdk-js/dist/clients/database/src/Database";

const queryRunDoc = {
    description: "Execute the query and return the results",
    parameters: ["query - you can specify the query to run as a parameter."],
    stdin: "If no parameters are specified, the query to run will be read from stdin.",
    options: {
        format: "choose the format of the response: text or json",
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
        console.error("No query specified.");
        process.exit(-1);
    }

    let result = await WAII.Query.run({query: query});

    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        default: {
            if (result.column_definitions && result.rows) {
                // Define the columns based on the result's column definitions
                const columns = result.column_definitions.map((c) => {
                    return {name: c.name, alignment: 'left'}; // you can customize alignment here
                });

                // Create a new Table with the columns
                const p = new Table({columns});

                // Iterate through the rows and add them to the table
                for (const row of result.rows) {
                    const rowObj: { [key: string]: any } = {};
                    for (const column of result.column_definitions) {
                        rowObj[column.name] = (row as IIndexable)[column.name];
                    }
                    p.addRow(rowObj);
                }

                // Print the table
                p.printTable();
            }
        }
    }
}


const queryCommands = {
    create: {fn: queryCreate, doc: queryCreateDoc},
    update: {fn: queryUpdate, doc: queryUpdateDoc},
    explain: {fn: queryExplain, doc: queryExplainDoc},
    describe: {fn: queryExplain, doc: queryDiffDoc},
    rewrite: {fn: queryRewrite, doc: queryRewriteDoc},
    transcode: {fn: queryTranscode, doc: queryTranscodeDoc},
    diff: {fn: queryDiff, doc: queryDiffDoc},
    run: {fn: queryRun, doc: queryRunDoc}
};

export {queryCommands, printQuery}
