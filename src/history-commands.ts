import WAII from '../../waii-sdk-js'
import { GeneratedQueryHistoryEntry } from '../../waii-sdk-js/clients/history/src/History';
import { CmdParams } from './cmd-line-parser';

const printHistory = (history: GeneratedQueryHistoryEntry[]) => {
    console.log("favorite, question, query, tables, timestamp");
    for (const entry of history) {
        console.log(""+
            entry.query.liked+", "+
            entry.request.ask+", \""+
            entry.query.query+"\", "+
            entry.query.tables.map((t) => t.schema_name + '.' + t.table_name).join(" ")+", "+
            entry.query.timestamp_ms
        );
    }
}

const historyList = async (params: CmdParams) => {
    let result = await WAII.History.list();
    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        default: {
            printHistory(result.history);
        }
    }
}

const historyCommands = {
    list: historyList,
};

export { historyCommands };