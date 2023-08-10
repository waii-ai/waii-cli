#!/usr/bin/env node

import WAII from 'waii-sdk-js'
import process = require("node:process")
import * as fs from 'fs'
import * as YAML from 'yaml'
import { parseInput, CmdParams } from "./cmd-line-parser";
import { databaseCommands, schemaCommands, tableCommands } from "./database-commands";
import { queryCommands } from "./query-commands";
import { semanticCommands } from "./semantic-commands";
import { historyCommands } from './history-commands';

const CONF_FILE = '~/.waii/conf.yaml';

const help = () => {
    console.log('Usage: waii <cmd> <subcommand> <values> <flags>');
    console.log('')
    console.log('Commands and subcommands')
    console.log('========================')
    printCommands(callTree)
    console.log('')
    console.log('Examples')
    console.log('========')
    console.log('   waii database list')
    console.log('   waii database list -format=json')
    console.log('   waii context list')
    console.log('   waii context list -format=json')
    console.log('   waii schema describe schema_name')
    console.log('   waii table describe schema_name.table_name')
    console.log('   waii history')
    console.log('   waii history list -format=json')
    process.exit(-1);
}

/**
 * Print all commands and its sub commands.
 * Ideally have to use args parser for printing help better.
 * @param commands
 * @param prefix
 */
function printCommands(commands: any, prefix = '') {
    for (const key in commands) {
        if (typeof commands[key] === 'object') {
            console.log(prefix + key + ':');
            printCommands(commands[key], prefix + '  ');
        } else {
            console.log(prefix + key);
        }
    }
}

const callTree = {
    query: queryCommands,
    database: databaseCommands,
    context: semanticCommands,
    schema: schemaCommands,
    table: tableCommands,
    history: historyCommands
};

const initialize = async () => {
    let path = process.env.HOME + CONF_FILE.slice(1);
    const file = fs.readFileSync(path, 'utf8');
    let config = YAML.parse(file);
    WAII.initialize(config.url, config.apiKey);
    let result = await WAII.Database.getConnections({});
    if (result.connectors && result.connectors.length > 0) {
        WAII.Database.activateConnection(result.connectors[0].key);
    }
}

const main = async () => {
    try {
        let params = parseInput(process.argv);
        let scmdTree = callTree[params.cmd as keyof typeof callTree];
        let fn: (arg: CmdParams) => void = scmdTree[params.scmd as keyof typeof scmdTree];
        if (!fn) {
            throw Error("Unknown operation.");
        }
        await initialize();
        await fn(params);
        process.exit(0);
    } catch (error) {
        if (error instanceof Error) {
            console.log(error.message);
        } else {
            console.log(error);
        }
        help();
    }
}

main();
