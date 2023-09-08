import WAII from 'waii-sdk-js'
import { CmdParams } from './cmd-line-parser';
import { SemanticStatement } from "waii-sdk-js/dist/clients/semantic-context/src/SemanticContext";
import { Table } from "console-table-printer";
import { IIndexable } from "./query-commands";

const printStatements = (statements?: SemanticStatement[]) => {
    if (!statements) {
        console.log("No statements found.");
        return;
    }
    const p = new Table({
        columns: [
            { name: 'scope', alignment: 'left', maxLen: 10, minLen: 1 },
            { name: 'statement', alignment: 'left', minLen: 40, maxLen: 40 }
            // { name: 'labels', alignment: 'left' }
        ], rowSeparator: true
    });
    for (const stmt of statements) {
        p.addRow({
            scope: stmt.scope,
            statement: stmt.statement,
            // labels: stmt.labels
        });
    }
    p.printTable();
}

const contextList = async (params: CmdParams) => {
    let result = await WAII.SemanticContext.getSemanticContext();
    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        default: {
            printStatements(result.semantic_context);
        }
    }
}

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
    list: contextList,
    add: contextAdd,
    delete: contextDelete,
    import: contextImport
};

export { semanticCommands };
