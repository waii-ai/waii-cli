#!/usr/bin/env node

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

import WAII from 'waii-sdk-js'
import process = require("node:process")
import * as fs from 'fs'
import * as path from 'path';
import * as YAML from 'yaml'
import { parseInput, CmdParams, ArgumentError } from "./cmd-line-parser";
import { databaseCommands, schemaCommands, tableCommands } from "./database-commands";
import { queryCommands } from "./query-commands";
import { semanticCommands } from "./semantic-commands";
import { semanticLayerDumpCommands } from "./semantic-layer-dump-commands";
import { historyCommands } from './history-commands';
import { userCommands } from './user-commands';
import { generateCliReference } from './doc-generator';

const CONF_FILE = '~/.waii/conf.yaml';
const DEFAULT_API_KEY_IN_TEMPLATE = '<your_waii_api_key_here>'

const help = (cmd: string = "", scmd: string = "") => {
    if (cmd && scmd) {
        let scmdTree = callTree[cmd as keyof typeof callTree];
        let doc = scmdTree[scmd as keyof typeof scmdTree]['doc'];
        if (!doc) {
            throw new ArgumentError("No help for " + cmd + " " + scmd);
        }

        console.error('');
        console.error("Usage: waii " + cmd + " " + scmd + " <values> <flags>");
        console.error('');
        console.error("Description: " + doc['description']);
        console.error('');
        if (doc['parameters']) {
            console.error("Values: " + ((doc['parameters'] as string[])).join(', '));
            console.error('');
        }
        if (doc['options']) {
            console.error("Flags:");
            for (const opt in (doc['options'] as any)) {
                console.error("   " + opt + ": " + doc['options'][opt]);
            }
            console.error('');
        }
        if (doc['stid']) console.log("Stdin: " + doc['stdin']);
        console.error('');
    } else {
        console.error('Usage: waii <cmd> <subcommand> <values> <flags>');
        console.error('')
        console.error('Commands and subcommands')
        console.error('========================')
        console.error('');
        printCommands(callTree)
        console.error('Examples')
        console.error('========')
        console.error('   waii database list')
        console.error('   waii database list --format json')
        console.error('   waii context list')
        console.error('   waii context list --format json')
        console.error('   waii schema describe schema_name')
        console.error('   waii table describe schema_name.table_name')
        console.error('   waii history')
        console.error('   waii history list --format json')
        console.error('   ');
        console.error('Use: "waii help <cmd> <scmd>" to get details of a command.')
    }
}

function printCommands(commands: any, level: number = 0) {
    for (const o in commands) {
        process.stdout.write("   ".repeat(level) + o + ':');
        if (level === 0) {
            console.log("");
            printCommands(commands[o], level + 1);
        } else {
            if (typeof commands[o] === 'object') {
                console.log(" ".repeat(22 - o.length - 4) + (commands[o]['doc'] ? commands[o]['doc']['description'] : ''));
            }
        }
    }
    console.log('');
}

export const callTree = {
    query: queryCommands,
    database: databaseCommands,
    context: semanticCommands,
    schema: schemaCommands,
    table: tableCommands,
    history: historyCommands,
    user: userCommands,
    "semantic-layer": semanticLayerDumpCommands,
    docs: {
        generate: {
            fn: async () => {
                generateCliReference(callTree);
            },
            doc: {
                description: 'Generate CLI documentation',
                parameters: [],
                options: {}
            }
        }
    }
};

function checkNodeVersion(requiredVersion: number): boolean {
    const currentVersion = process.version;
    const majorVersion = parseInt(currentVersion.split('.')[0].slice(1)); 
  
    return majorVersion >= requiredVersion; 
}
  
const initialize = async () => {
    let configPath = process.env.HOME + CONF_FILE.slice(1);

    // Check if directory doesn't exist
    let dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true }); // Create directory recursively if it doesn't exist
    }

    // Check if file doesn't exist
    if (!fs.existsSync(configPath)) {
        // Create a YAML file with placeholders
        let placeholderConfig = {
            url: 'https://tweakit.waii.ai/api/',
            apiKey: DEFAULT_API_KEY_IN_TEMPLATE,
        };

        let yamlStr = YAML.stringify(placeholderConfig);
        fs.writeFileSync(configPath, yamlStr, 'utf8');
    }

    const file = fs.readFileSync(configPath, 'utf8');
    let config = YAML.parse(file);

    if (config.apiKey == DEFAULT_API_KEY_IN_TEMPLATE || config.apiKey == '') {
        throw Error("Please provide your Waii API key in the config file: " + configPath)
    }

    WAII.initialize(config.url, config.apiKey);
    let result = await WAII.Database.getConnections({});

    if (result.default_db_connection_key) {
        await WAII.Database.activateConnection(result.default_db_connection_key);
    } else if (result.connectors && result.connectors.length > 0) {
        await WAII.Database.activateConnection(result.connectors[0].key);
    }
}

const main = async () => {
    try {
        const requiredNodeVersion = 18;
        if (!checkNodeVersion(requiredNodeVersion)) {
            console.error(`Your Node.js version is ${process.version}. This application requires Node.js v${requiredNodeVersion} or higher.`);
            process.exit(1);
        }    
        let params = await parseInput(process.argv);
        if (params.cmd === 'help') {
            help(params.scmd, params.vals[0]);
        } else {
            let scmdTree = callTree[params.cmd as keyof typeof callTree];
            if (!scmdTree) {
                throw new ArgumentError("Unknown command " + params.cmd);
            }

            let callObj = scmdTree[params.scmd as keyof typeof scmdTree];
            if (!callObj) {
                throw new ArgumentError("Unknown subcommand " + params.scmd);
            }

            let fn: (arg: CmdParams) => void = callObj['fn'];
            if (!fn) {
                throw new ArgumentError("Unknown operation.");
            }
            await initialize();
            await fn(params);
        }
        process.exitCode = 0;
    } catch (error) {
        if (error instanceof ArgumentError) {
            console.error();
            console.error("Error: ", error.message);
            console.error();
            console.error();
            help();
        } else if (error instanceof Error) {
            console.error();
            let msg = error.message;
            try {
                let obj = JSON.parse(error.message);
                msg = obj.detail;
            } catch (err) { }
            console.error("Error: ", msg);
            console.error();
            console.error();
        } else {
            console.log(error);
        }
        process.exitCode = -1;
    }
};

main();

/*let timer = setTimeout(function () {
    clearTimeout(timer);
    log() // logs out active handles that are keeping node running
  }, 10000);*/

export { 
    queryCommands,
    databaseCommands,
    semanticCommands,
    semanticLayerDumpCommands,
    schemaCommands,
    tableCommands,
    historyCommands,
    userCommands
};
