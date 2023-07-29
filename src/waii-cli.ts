import process = require("node:process")
import WAII from '../../waii-sdk-js'
import * as fs from 'fs'
import * as YAML from 'yaml'

const help = () => {
    console.log('Usage: waii <cmd> <subcommand> <values> <flags>');
    process.exit(-1);
}

type CmdParams = {
    cmd: string,
    scmd: string,
    vals: string[],
    opts: {flag: string, value?: string}[]
}

const parseInput = (args: string[]) => {
    if (args.length < 4) {
        help();
    }

    const params: CmdParams = {
        cmd: process.argv[2].trim().toLowerCase(),
        scmd: process.argv[3].trim().toLowerCase(),
        vals: [],
        opts: []
    }

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
                params.opts.push({flag: a});
            } else {
                inFlag = false;
                params.opts[params.opts.length-1].value = a;
            }
        } else {
            if (a.startsWith('-')) {
                inFlag = true;
                params.opts.push({flag: a})
            } else {
                help();
            }
        }
    }

    return params;
}

const queryCreate = (params: CmdParams) => {
    WAII.Query.generate(
        {
            ask: params.vals[0]
        },
        (result) => {
            console.log(result.query);
            process.exit(0);
        },
        (detail) => {
            console.error(JSON.stringify(detail));
            process.exit(-1);
        }
    )
}

const queryUpdate = (params: CmdParams) => {
    console.log("query update", params);
}

const queryExplain = (params: CmdParams) => {
    console.log("query explain", params);
}

const queryRewrite = (params: CmdParams) => {
    console.log("query rewrite", params);
}

const queryTranscode = (params: CmdParams) => {
    console.log("query transcode", params);
}

const queryDiff = (params: CmdParams) =>  {
    console.log("query diff", params);
}

const callTree = {
    query: {
        create: queryCreate,
        update: queryUpdate,
        explain: queryExplain,
        rewrite: queryRewrite,
        transcode: queryTranscode,
        diff: queryDiff
    }
}

const params = parseInput(process.argv);
const CONF_FILE = '~/.waii/conf.yaml';

const initializeAndRun = (fn) => {
    let path = process.env.HOME + CONF_FILE.slice(1);
    const file = fs.readFileSync(path, 'utf8');
    let config = YAML.parse(file);
    WAII.initialize(config.url, config.apiKey);
    WAII.Database.getConnections(
        {},
        (result) => {
            WAII.Database.activateConnection(result.connectors[2].key);
            fn(params);
        },
        (detail) => {
            console.log(detail);
        } 
    )
}

try {
    let scmdTree = callTree[params.cmd as keyof typeof callTree];
    let fn = scmdTree[params.scmd as keyof typeof scmdTree];
    initializeAndRun(fn);
} catch (error) {
    console.log(error);
    help();
}