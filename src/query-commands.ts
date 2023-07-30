import WAII from '../../waii-sdk-js'
import { CmdParams } from './cmd-line-parser';

const queryCreate = async (params: CmdParams) => {
    let result = await WAII.Query.generate({ ask: params.vals[0] });
    console.log(result.query);
}

const queryUpdate = async (params: CmdParams) => {
    let query = params.input;
    let descResult = await WAII.Query.describe({ query: query });
    let genResult = await WAII.Query.generate({
        ask: params.vals[0],
        tweak_history: [{ ask: descResult.summary, sql: query }]
    });
    console.log(genResult.query);
}

const queryExplain = async (params: CmdParams) => {
    let query = params.input;
    let result = await WAII.Query.describe({ query: query });
    console.log("Summary: \n--------");
    console.log(result.summary);
    console.log("\nTables: \n-------");
    console.log(result.tables.map((tname) => { return tname.schema_name + tname.table_name; }).join('\n'));
    console.log("\nSteps: \n------");
    console.log(result.detailed_steps.join('\n\n'));
}

const queryRewrite = async (params: CmdParams) => {
    params.vals[0] = "Rewrite the query to proudce the same output in a more readable way.";
    await queryUpdate(params);
}

const queryTranscode = async (params: CmdParams) => {
    params.vals[0] = "Rewrite the query to produce the same output but use " + params.vals[0] + " instead of snowflake.";
    await queryUpdate(params);
}

const queryDiff = async (params: CmdParams) => {
    console.error("Query diff not yet implemented.");
    process.exit(-1);
}

const queryRun = async (params: CmdParams) => {
    let query = params.input;
    let result = await WAII.Query.run({ query: query });
    console.log(result.column_definitions.map((c) => { return c.name; }).join(', '));
    for (const row of result.rows) {
        let str = '';
        let first = true;
        for (const column of result.column_definitions) {
            if (!first) {
                str += ", ";
            }
            first = false;
            str += row[column.name.toLocaleLowerCase()];
        }
        console.log(str);
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

export { queryCommands }