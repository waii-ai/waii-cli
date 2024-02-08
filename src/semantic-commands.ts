import WAII from 'waii-sdk-js'
import { CmdParams } from './cmd-line-parser';
import { SemanticStatement } from "waii-sdk-js/dist/clients/semantic-context/src/SemanticContext";
import { Table } from "console-table-printer";
import { IIndexable } from "./query-commands";

const printStatements = (statements?: SemanticStatement[], total?: number) => {
    if (!statements) {
        console.log("No statements found.");
        return;
    }
    
    const p = new Table({
        columns: [
            { name: 'scope', alignment: 'left', maxLen: 10, minLen: 1 },
            { name: 'statement', alignment: 'left', minLen: 40, maxLen: 40 },
            { name: 'labels', alignment: 'left', minLen: 1, maxLen: 20 }
        ], rowSeparator: true
    });

    for (const stmt of statements) {
        p.addRow({
            scope: stmt.scope,
            statement: stmt.statement,
            labels: stmt.labels
        });
    }
    p.printTable();

    if (total) {
        console.log();
        console.log(total + " additional statements available");
    }
}

const contextListDoc = {
    description: "List all semantic context of the current database.",
    parameters: [],
    stdin: "",
    options: {
        limit: "How many statements to fetch",
        offset: "Which statement to start with",
        search: "Which string to search for in the statements",
        always_include: "Filter that decides which type of statement to fetch",
        format: "Choose the format of the response: text or json.",
    }
};
const contextList = async (params: CmdParams) => {

    let always_include: boolean = 'always_include' in params.opts ? (params.opts['always_include'] ? true : false) : false;
    let search: string = 'search' in params.opts ? params.opts['search'] : '';
    let offset: number = 'offset' in params.opts ? +params.opts['offset'] : 0;
    let limit: number = 'limit' in params.opts ? +params.opts['limit'] : 100;

    let result = await WAII.SemanticContext.getSemanticContext(
        {
            filter: {
                always_include: always_include
            },
            search_text: search,
            offset: offset,
            limit: limit
        }
    );

    // filter result to only show the statements which has id != null
    let filteredResult = []
    if (result.semantic_context !== undefined) {
        result.semantic_context = result.semantic_context.filter((stmt: SemanticStatement) => stmt.id !== null);
    }

    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        default: {
            printStatements(result.semantic_context, result.total_candidates);
        }
    }
}

const contextImportDoc = {
    description: "Import semantic statements in bulk. Duplicates will be ignored.",
    parameters: [],
    stdin: "The statements to load. The input must be of the format returned by 'waii context list'.",
    options: {
    }
};
const contextImport = async (params: CmdParams) => {
    let context = await WAII.SemanticContext.getSemanticContext();
    let importContext = JSON.parse(params.input);
    let totalCounter = 0;
    let importCounter = 0;

    for (const stmt of importContext.semantic_context) {
        let found = false;
        totalCounter = totalCounter + 1;
        if (context.semantic_context) {
            for (const current of context.semantic_context) {
                if (current.scope === stmt.scope && current.statement === stmt.statement) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                let newStatement: SemanticStatement = new SemanticStatement(
                    stmt.scope,
                    stmt.statement
                );
                let result = await WAII.SemanticContext.modifySemanticContext(
                    {
                        updated: [newStatement]
                    }
                );
                importCounter = importCounter + 1;
            }
        }
    }
    console.log("Read ", totalCounter, " statement(s), ", "imported ", importCounter, " statement(s)");
}

function stringToBoolean(str: string): boolean {
    return /^(true|1|yes|y)$/i.test(str.trim());
}

const contextAddDoc = {
    description: "Create a new semantic statement in the semantic context.",
    parameters: [""],
    stdin: "",
    options: {
        format: "choose the format of the response: text or json.",
        scope: "The scope of the statement: [[[[<db>].<schema>].<table>].<column>]",
        labels: "Comma separated list of labels for the statement: 'performance, finance'",
        always_include: "Whether the statement should be dynamically selected by query or always included.",
        search_keys: "Comma separated list of keys to use.",
        extract_prompt: "Prompt to be used to extract information when the statement is used."
    }
};
const contextAdd = async (params: CmdParams) => {
    let stmt: SemanticStatement = new SemanticStatement(
        params.opts['scope'],
        params.vals[0],
        params.opts['labels'].split(',').map((s) => s.trim()),
        stringToBoolean(params.opts['always_include']),
        params.opts['search_keys'].split(',').map((s) => s.trim()),
        params.opts['extract_prompt']
    );
    let result = await WAII.SemanticContext.modifySemanticContext(
        {
            updated: [stmt]
        }
    );
    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        default: {
            printStatements(result.updated);
        }
    }
}

const contextDeleteDoc = {
    description: "Delete a statement from the semantic context.",
    parameters: ["uuid of the statement to be deleted."],
    stdin: "",
    options: {
        format: "choose the format of the response: text or json."
    }
};
const contextDelete = async (params: CmdParams) => {
    let result = await WAII.SemanticContext.modifySemanticContext({
        updated: [],
        deleted: params.vals
    });
    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        default: {
            printStatements(result.updated);
        }
    }
}

const semanticCommands = {
    list: { fn: contextList, doc: contextListDoc },
    add: { fn: contextAdd, doc: contextAddDoc },
    delete: { fn: contextDelete, doc: contextDeleteDoc },
    import: { fn: contextImport, doc: contextImportDoc }
};

export { semanticCommands };
