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

const queryCreate = async (params: CmdParams) => {
    let dialect = params.opts['dialect']

    let result = await WAII.Query.generate({ask: params.vals[0], dialect: dialect});
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

const queryDiff = async (params: CmdParams) => {
    let query = params.input;
    // load it from file
    let old_query_file = params.opts['previous_query_file'];
    let prev_query = ""
    if (old_query_file) {
        let fs = require('fs');
        prev_query = fs.readFileSync(old_query_file, 'utf8');
    } else {
        console.error("You must specify a previous query file to diff against by using -previous_query_file.");
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

const queryRewrite = async (params: CmdParams) => {
    params.vals[0] = "Rewrite the query to proudce the same output in a more readable way.";
    await queryUpdate(params);
}

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

const queryRun = async (params: CmdParams) => {
    let example_command_str = "`cat query.sql | waii query run` or `echo 'select 1' | waii query run`"

    if (params.vals.length > 0) {
        console.error("You cannot specify a SQL query as a parameter to run when using the `waii query run` command. " +
            "You should send the query in as input of the command. e.g. " + example_command_str);
        process.exit(-1);
    }

    let query = params.input;

    if (!query) {
        console.error("No query specified. You should specify query via input: e.g. " + example_command_str);
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
    create: queryCreate,
    update: queryUpdate,
    explain: queryExplain,
    describe: queryExplain,
    rewrite: queryRewrite,
    transcode: queryTranscode,
    diff: queryDiff,
    run: queryRun,
};

export {queryCommands, printQuery}
