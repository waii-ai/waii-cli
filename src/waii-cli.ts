import WAII from '../../waii-sdk-js'
import process = require("node:process")
import * as fs from 'fs'
import * as YAML from 'yaml'
import { parseInput, CmdParams } from "./cmd-line-parser";
import { databaseCommands, schemaCommands, tableCommands } from "./database-commands";
import { queryCommands } from "./query-commands";
import { semanticCommands } from "./semantic-commands";

const CONF_FILE = '~/.waii/conf.yaml';

const help = () => {
    console.log('Usage: waii <cmd> <subcommand> <values> <flags>');
    process.exit(-1);
}

const callTree = {
    query: queryCommands,
    database: databaseCommands,
    context: semanticCommands,
    schema: schemaCommands,
    table: tableCommands
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