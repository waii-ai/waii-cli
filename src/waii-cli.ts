import process = require("node:process")
import WAII from '../../waii-sdk-js'
import * as fs from 'fs'
import * as YAML from 'yaml'
import { DBConnection, ModifyDBConnectionRequest } from "../../waii-sdk-js/clients/database/src/Database";
import { SemanticStatement } from "../../waii-sdk-js/clients/semantic-context/src/SemanticContext";

const CONF_FILE = '~/.waii/conf.yaml';

const help = () => {
    console.log('Usage: waii <cmd> <subcommand> <values> <flags>');
    process.exit(-1);
}

type CmdParams = {
    cmd: string,
    scmd: string,
    vals: string[],
    opts: {}
}

const parseInput = (args: string[]) => {
    if (args.length < 4) {
        help();
    }

    const params: CmdParams = {
        cmd: process.argv[2].trim().toLowerCase(),
        scmd: process.argv[3].trim().toLowerCase(),
        vals: [],
        opts: {}
    }

    let flags = [];

    let inValues = true;
    let inFlag = false;

    for (const a of args.slice(4)) {
        if (inValues) {
            if (a.startsWith('-')) {
                inValues = false;
            } else {
                params.vals.push(a);
                continue;
            }
        }

        if (inFlag) {
            if (a.startsWith('-')) {
                flags.push({ flag: a });
            } else {
                inFlag = false;
                flags[flags.length - 1].value = a;
            }
        } else {
            if (a.startsWith('-')) {
                inFlag = true;
                flags.push({ flag: a })
            } else {
                help();
            }
        }
    }

    for (const f of flags) {
        params.opts[f.flag.slice(1)] = f.value;
    }

    return params;
}

const queryCreate = async (params: CmdParams) => {
    let result = await WAII.Query.generate({ ask: params.vals[0] });
    console.log(result.query);
}

const queryUpdate = async (params: CmdParams) => {
    let query = fs.readFileSync(0, 'utf-8');
    let descResult = await WAII.Query.describe({ query: query });
    let genResult = await WAII.Query.generate({
        ask: params.vals[0],
        tweak_history: [{ ask: descResult.summary, sql: query }]
    });
    console.log(genResult.query);
}

const queryExplain = async (params: CmdParams) => {
    let query = fs.readFileSync(0, 'utf-8');
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
    params.vals[0] = "Rewrite the query to produce the same output but use "+params.vals[0]+" instead of snowflake.";
    await queryUpdate(params);
}

const queryDiff = async (params: CmdParams) => {
    console.error("Query diff not yet implemented.");
    process.exit(-1);
}

const queryRun = async (params: CmdParams) => {
    let query = fs.readFileSync(0, 'utf-8');
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

const printConnectors = (connectors: DBConnection[]) => {
    console.log("account, database, warehouse, role, user, key");
    for (const connection of connectors) {
        console.log(
            connection.account_name+', '+
            connection.database+', '+
            connection.warehouse+', '+
            connection.role+', '+
            connection.username+', '+
            connection.key+', ');
    }
}

const databaseList = async (params: CmdParams) => {
    let result = await WAII.Database.getConnections();
    printConnectors(result.connectors);
}

const databaseDelete = async (params: CmdParams) => {
    let result = await WAII.Database.modifyConnections({removed: [params.vals[0]]});
    printConnectors(result.connectors);
}

const databaseAdd = async (params: CmdParams) => {
    let result = await WAII.Database.modifyConnections(
        {
            updated: [{
                key: null,
                account_name: params.opts['a'],
                database: params.opts['d'],
                warehouse: params.opts['w'],
                role: params.opts['r'],
                username: params.opts['u'],
                password: params.opts['p'],
                db_type: 'snowflake',
            }]
        }
    );
    printConnectors(result.connectors);
}

const databaseActivate = async (params: CmdParams) => {
    WAII.Database.activateConnection(params.vals[0]);
}

const printStatements = (statements: SemanticStatement[]) => {
    console.log("id, scope, statement, labels");
    for (const stmt of statements) {
        console.log(
            stmt.id+', '+
            stmt.scope+', '+
            stmt.statement+', '+
            stmt.labels);
    }
}

const contextList = async (params: CmdParams) => {
    let result = await WAII.SemanticContext.getSemanticContext();
    printStatements(result.semantic_context);
}

const contextAdd = async (params: CmdParams) => {
    let stmt: SemanticStatement = new SemanticStatement(
        params.opts['s'],
        params.vals[0]
    );
    let result = await WAII.SemanticContext.modifySemanticContext(
        {
            updated: [stmt]
        }
    );
    printStatements(result.updated);
}

const contextDelete = async (params: CmdParams) => {
    let result = await WAII.SemanticContext.modifySemanticContext({
        updated: [],
        deleted: params.vals
    });
    printStatements(result.updated);
}

const callTree = {
    query: {
        create: queryCreate,
        update: queryUpdate,
        explain: queryExplain,
        describe: queryExplain,
        rewrite: queryRewrite,
        transcode: queryTranscode,
        diff: queryDiff,
        run: queryRun,
    },
    database: {
        list: databaseList,
        add: databaseAdd,
        delete: databaseDelete,
        activate: databaseActivate,
    },
    context: {
        list: contextList,
        add: contextAdd,
        delete: contextDelete
    }
};

const initialize = async () => {
    let path = process.env.HOME + CONF_FILE.slice(1);
    const file = fs.readFileSync(path, 'utf8');
    let config = YAML.parse(file);
    WAII.initialize(config.url, config.apiKey);
    let result = await WAII.Database.getConnections({});
    WAII.Database.activateConnection(result.connectors[2].key);
}

const main = async () => {
    try {
        let params = parseInput(process.argv);
        let scmdTree = callTree[params.cmd as keyof typeof callTree];
        let fn: (CmdParams) => void = scmdTree[params.scmd as keyof typeof scmdTree];
        if (!fn) {
            throw Error("Unknown operation.");
        }
        await initialize();
        await fn(params);
        process.exit(0);
    } catch (error) {
        console.log(error.message);
        help();
    }
}

main();