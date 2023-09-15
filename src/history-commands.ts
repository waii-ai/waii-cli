import WAII from 'waii-sdk-js'
import {GeneratedQueryHistoryEntry} from 'waii-sdk-js/dist/clients/history/src/History';
import {CmdParams} from './cmd-line-parser';
import {Table} from "console-table-printer";
import {printQuery} from "./query-commands";

/**
 * "," is commonly presently in SQL & cause difficulty in parsing.
 * Using "|" as separator, so that it is easier to view in spreadsheets.
 *
 * @param history
 */
const printHistory = (history: GeneratedQueryHistoryEntry[], limit: number) => {
    // filter out entries with empty query
    history = history.filter((entry) => {
        return entry.query
    })

    history.sort((a, b) => {
        // @ts-ignore
        return b.query.timestamp_ms - a.query.timestamp_ms;
    })

    // pick top 10 entries
    history = history.slice(0, limit);

    for (const entry of history) {
        if (!entry.query || !entry.request) {
            continue;
        }
        if (!entry.query.tables) {
            entry.query.tables = [];
        }
        if (!entry.request.ask) {
            entry.request.ask = '';
        }
        if (!entry.query.query) {
            entry.query.query = '';
        }

        const p = new Table({columns: [
                {name: 'property', alignment: 'left'},
                {name: 'value', alignment: 'left', maxLen: 60, minLen: 40},
            ], rowSeparator: true});

        p.addRow({
            property: 'uuid',
            value: entry.query.uuid
        }
        );
        p.addRow({
            property: 'favorite',
            value: entry.query.liked ? 'true' : 'false'
        })
        p.addRow({
            property: 'question',
            value: entry.request.ask.replace(/\n/g, '\\n')
        })
        p.addRow({
            property: 'tables',
            value: entry.query.tables?.map((t) => t.schema_name + '.' + t.table_name).join(" ")
        })
        p.printTable();
        console.log("Query: ")
        console.log("```")
        printQuery(entry.query.query);
        console.log("```")

        // print separator
        console.log("------------------------------------------------------------");
    }
}

const historyListDoc = {
    description: "Show the query history.",
    parameters: [],
    stdin: "",
    options: {
        format: "choose the format of the response: text or json.",
        limit: "choose how many items to list."
    }
};
const historyList = async (params: CmdParams) => {
    let limit = 10
    if (params.opts['limit']) {
        limit = parseInt(params.opts['limit'])
    }

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
            printHistory(result.history, limit);
        }
    }
}

const historyCommands = {
    list: {fn: historyList, doc: historyListDoc}
};

export { historyCommands };
