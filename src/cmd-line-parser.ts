import * as fs from 'fs'
const readline = require('readline');

type CmdParams = {
    cmd: string,
    scmd: string,
    vals: string[],
    opts: { [key: string]: any },
    input: string
}

class ArgumentError extends Error { };

async function readStdin() {
    const rl = readline.createInterface({
        input: process.stdin
    });

    let content = '';

    for await (const line of rl) {
        content += line + '\n';
    }

    return content;
}

const parseInput = async (args: string[]) => {
    if (args.length < 4) {
        throw new ArgumentError("Too few parameters.")
    }

    const params: CmdParams = {
        cmd: process.argv[2].trim().toLowerCase(),
        scmd: process.argv[3].trim().toLowerCase(),
        vals: [],
        opts: {},
        input: ''
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
                flags.push({ flag: a, value: '' });
            } else {
                inFlag = false;
                flags[flags.length - 1].value = a;
            }
        } else {
            if (a.startsWith('-')) {
                inFlag = true;
                flags.push({ flag: a, value: '' })
            } else {
                throw new ArgumentError('Command line flags can only have one value.');
            }
        }
    }

    for (const f of flags) {
        const flagKey = f.flag.slice(f.flag.startsWith('--') ? 2 : 1);

        if (params.opts[flagKey]) {
            if (!Array.isArray(params.opts[flagKey])) {
                params.opts[flagKey] = [params.opts[flagKey]];
            }
            params.opts[flagKey].push(f.value);
        } else {
            params.opts[flagKey] = f.value
        }
    }

    if (process.stdin.isTTY) {
        params.input = '';
    } else {
        params.input = await readStdin();
    }

    return params;
}

export { parseInput, CmdParams, ArgumentError }
