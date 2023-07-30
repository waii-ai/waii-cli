import WAII from '../../waii-sdk-js'
import { CmdParams } from './cmd-line-parser';
import { SemanticStatement } from "../../waii-sdk-js/clients/semantic-context/src/SemanticContext";

const printStatements = (statements: SemanticStatement[]) => {
    console.log("id, scope, statement, labels");
    for (const stmt of statements) {
        console.log(
            stmt.id + ', ' +
            stmt.scope + ', ' +
            stmt.statement + ', ' +
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

const semanticCommands = {
    list: contextList,
    add: contextAdd,
    delete: contextDelete
};

export { semanticCommands };