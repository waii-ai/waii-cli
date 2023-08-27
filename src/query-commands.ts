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
    let result = await WAII.Query.generate({ask: params.vals[0]});
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
    let descResult = await WAII.Query.describe({query: query});
    let genResult = await WAII.Query.generate({
        ask: params.vals[0],
        tweak_history: [{ask: descResult.summary, sql: query}]
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

const queryExplain = async (params: CmdParams) => {
    let query = params.input;
    let result = await WAII.Query.describe({query: query});
    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        default: {
            console.log("Summary: \n--------");
            console.log(result.summary);
            console.log("\nTables: \n-------");
            console.log((result.tables ? result.tables : []).map((tname) => {
                return tname.schema_name + "." + tname.table_name;
            }).join('\n'));
            console.log("\nSteps: \n------");
            console.log((result.detailed_steps ? result.detailed_steps : []).join('\n\n'));
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
    let msg = "Rewrite the query to produce the same output in " + to_dialect + ", keep the logic as close as possible"
    if (from_dialect) {
        msg += " to " + from_dialect;
    }

    params.vals[0] = msg
    await queryUpdate(params);
}

const queryDiff = async (params: CmdParams) => {
    console.error("Query diff not yet implemented.");
    process.exit(-1);
}

import {Table} from 'console-table-printer';

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
                        rowObj[column.name] = (row as IIndexable)[column.name.toLocaleLowerCase()];
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
