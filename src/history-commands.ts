import WAII from 'waii-sdk-js'
import { GeneratedQueryHistoryEntry } from 'waii-sdk-js/dist/clients/history/src/History';
import { CmdParams } from './cmd-line-parser';

/**
 * "," is commonly presently in SQL & cause difficulty in parsing.
 * Using "|" as separator, so that it is easier to view in spreadsheets.
 *
 * @param history
 */
const printHistory = (history: GeneratedQueryHistoryEntry[]) => {
    console.log("uuid|favorite|question|query|tables|timestamp");
    for (const entry of history) {
        if (!entry.query || !entry.request) {
            continue;
        }
        if (!entry.query.tables) {
            entry.query.tables = [];
        }
        console.log("" +
            entry.query.uuid + "| " +
            entry.query.liked + "| " +
            entry.request.ask.replace(/\n/g, '\\n') + "| \"" +
            entry.query.query.replace(/\n/g, '\\n') + "\"| " +
            entry.query.tables?.map((t) => t.schema_name + '.' + t.table_name).join(" ") + "| " +
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
            if (!result.history) {
                console.log("No history found.");
                return;
            }
            printHistory(result.history);
        }
    }
}

const historyCommands = {
    list: historyList,
};

export { historyCommands };
