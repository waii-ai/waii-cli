import WAII from 'waii-sdk-js'
import { CmdParams } from './cmd-line-parser';
import { GetSemanticContextResponse, SemanticStatement } from "waii-sdk-js/dist/clients/semantic-context/src/SemanticContext";
import { Table } from "console-table-printer";
import { IIndexable } from "./query-commands";

function processForTable(input: string | undefined, n: number): string {
  
    if (!input) {
        return '';
    }

    let s = input.replace(/(\r\n|\n|\r)/gm, "").trim();
    const words = s.split(/\s+/);
    const processedWords = words.map(word => {
      if (word.length > n) {
        return word.substring(0, n) + '...';
      }
      return word;
    });

    return processedWords.join(' ');
  }
  
const printStatements = (statements?: SemanticStatement[], total?: number) => {
    if (!statements) {
        console.log("No statements found.");
        return;
    }
    
    const p = new Table({
        columns: [
            //{ name: 'id', alignment: 'left', maxLen: 10, minLen: 1 },
            { name: 'scope', alignment: 'left', maxLen: 10},
            { name: 'statement', alignment: 'left', maxLen: 25},
            { name: 'labels', alignment: 'left', maxLen: 10},
            { name: 'always_include', alignment: 'left', maxLen: 5},
            { name: 'lookup_summaries', alignment: 'left', maxLen: 10},
            { name: 'summarization_prompt', alignment: 'left', maxLen: 20}
        ], rowSeparator: true
    });

    for (const stmt of statements) {
        p.addRow({
            //id: stmt.id,
            scope: processForTable(stmt.scope, 10),
            statement: processForTable(stmt.statement, 25),
            labels: processForTable(stmt.labels?.join(', '), 10),
            always_include: stmt.always_include,
            lookup_summaries: processForTable(stmt.lookup_summaries?.join(', '), 10),
            summarization_prompt: processForTable(stmt.summarization_prompt, 20)
        });
    }
    p.printTable();

    if (total) {
        console.log();
        console.log(total + " additional statements available");
    }
}

function stringToBoolean(str: string): boolean {
    return /^(true|1|yes|y)$/i.test(str.trim());
}

async function load_context(spec: any):Promise<GetSemanticContextResponse> {
    let remaining = spec.limit;

    // first try to load limit 0 to get the total number of statements
    spec.limit = 0
    let result = await WAII.SemanticContext.getSemanticContext(spec);

    // we won't load more than total available statements
    let total_available = result.available_statements ? result.available_statements : 0;
    if (total_available < remaining) {
        remaining = total_available;
    }

    while (remaining > 0) {
        spec.limit = Math.min(remaining, 1000);
        let batch_result = await WAII.SemanticContext.getSemanticContext(spec);
        if (batch_result.semantic_context && batch_result.semantic_context.length > 0) {
            // append the batch results to the final result
            result.semantic_context = [...(result.semantic_context ? result.semantic_context : []), ...(batch_result.semantic_context ? batch_result.semantic_context : [])];

            remaining -= batch_result.semantic_context.length;
            spec.offset += batch_result.semantic_context.length;

            console.log("Loaded ", batch_result.semantic_context.length, " statement(s), ", remaining, " remaining");
        } else {
            // no more statements to load
            break;
        }
    }

    return result;
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
        format: "Choose the format of the response: text or json."
    }
};
const contextList = async (params: CmdParams) => {

    let always_include: boolean | null = 'always_include' in params.opts ? stringToBoolean(params.opts['always_include']) : null;
    let search: string = 'search' in params.opts ? params.opts['search'] : '';
    let offset: number = 'offset' in params.opts ? +params.opts['offset'] : 0;
    let limit: number = 'limit' in params.opts ? +params.opts['limit'] : 100;

    let spec: any = {
        search_text: search,
        offset: offset,
        limit: limit
    };

    if (always_include !== null) {
        let filter = {
            always_include: always_include
        };
        spec.filter = filter;
    }
    
    let result = await load_context(spec);

    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        default: {
            printStatements(result?.semantic_context, result?.available_statements);
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
    let context = await load_context({limit: 1});
    context = await load_context({limit: context.available_statements});

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
                    stmt.statement,
                    stmt.labels,
                    stmt.always_include,
                    stmt.lookup_summaries,
                    stmt.summarization_prompt,
                    stmt.id,
                    stmt.critical ? stmt.critical : false
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

const contextAddDoc = {
    description: "Create a new semantic statement in the semantic context.",
    parameters: [""],
    stdin: "",
    options: {
        format: "choose the format of the response: text or json.",
        scope: "The scope of the statement: [[[[<db>].<schema>].<table>].<column>]",
        labels: "Comma separated list of labels for the statement: 'performance, finance'",
        always_include: "Whether the statement should be dynamically selected by query or always included.",
        lookup_summaries: "Comma separated list of summaries to use.",
        summarization_prompt: "Prompt to be used to extract information when the statement is used."
    }
};
const contextAdd = async (params: CmdParams) => {
    let stmt: SemanticStatement = new SemanticStatement(
        params.opts['scope'],
        params.vals[0],
        'labels' in params.opts ? params.opts['labels'].split(',').map((s: string) => s.trim()) : [],
        stringToBoolean(params.opts['always_include']),
        'lookup_summaries' in params.opts ? params.opts['lookup_summaries'].split(',').map((s: string) => s.trim()) : [],
        params.opts['summarization_prompt']
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

const contextDeleteAllDoc = {
    description: "Delete all added semantic contexts from the database",
    stdin: ""
};
const contextDeleteAll = async (params: CmdParams) => {
    // first print a warning and ask user to confirm the deletion, type 'yes' to confirm
    console.log("Warning: This will delete all added semantic contexts from the database.");
    console.log("Type 'yes' to confirm deletion:");
    let input = await new Promise<string>((resolve) => {
        process.stdin.once('data', (data) => {
            resolve(data.toString().trim());
        });
    });
    if (input !== 'yes') {
        console.log("Aborted..");
        return;
    }

    while (true) {
        let all_contexts = await WAII.SemanticContext.getSemanticContext({});
        if (!all_contexts.semantic_context) {
            break;
        }

        let all_contexts_ids = []
        for (const stmt of all_contexts.semantic_context) {
            if (stmt.id) {
                all_contexts_ids.push(stmt.id);
            }
        }

        if (all_contexts.semantic_context && all_contexts.semantic_context.length > 0) {
            let result = await WAII.SemanticContext.modifySemanticContext({
                updated: [],
                deleted: all_contexts_ids
            });

            if (result.deleted && result.deleted.length > 0) {
                console.log("Deleted ", result.deleted.length, " statement(s)");
            } else {
                console.log("No statements left to delete");
                return
            }
        } else {
            break;
        }
    }
}

const semanticCommands = {
    list: { fn: contextList, doc: contextListDoc },
    add: { fn: contextAdd, doc: contextAddDoc },
    delete: { fn: contextDelete, doc: contextDeleteDoc },
    import: { fn: contextImport, doc: contextImportDoc },
    delete_all: { fn: contextDeleteAll, doc: contextDeleteAllDoc }
};

export { semanticCommands };
