import * as fs from 'fs'

type CmdParams = {
    cmd: string,
    scmd: string,
    vals: string[],
    opts: {},
    input: string
}

const parseInput = (args: string[]) => {
    if (args.length < 4) {
        throw Error("Too few parameters.")
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
                throw Error('Command line flags can only have one value.');
            }
        }
    }

    for (const f of flags) {
        let cnt = 1;
        if (f.flag.startsWith('--')) {
            cnt = 2;
        }
        params.opts[f.flag.slice(cnt)] = f.value;
    }

    try {
        params.input = fs.readFileSync(0, 'utf-8');
    } catch (e) {
        // ignore, not all commands have input
    }

    return params;
}

export { parseInput, CmdParams }