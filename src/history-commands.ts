/**
 * Copyright 2023–2025 Waii, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


import WAII from 'waii-sdk-js';
import { GeneratedQueryHistoryEntry } from 'waii-sdk-js/dist/clients/history/src/History';
import { CmdParams } from './cmd-line-parser';
import { Table } from 'console-table-printer';
import { printQuery } from './query-commands';

/**
 * "," is commonly presently in SQL & cause difficulty in parsing.
 * Using "|" as separator, so that it is easier to view in spreadsheets.
 *
 * @param history
 */
const printHistory = (history: GeneratedQueryHistoryEntry[]) => {
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

        const p = new Table({
            columns: [
                { name: 'property', alignment: 'left' },
                { name: 'value', alignment: 'left', maxLen: 60, minLen: 40 }
            ], rowSeparator: true
        });

        p.addRow({
            property: 'uuid',
            value: entry.query.uuid
        }
        );
        p.addRow({
            property: 'favorite',
            value: entry.query.liked ? 'true' : 'false'
        });
        p.addRow({
            property: 'question',
            value: entry.request.ask.replace(/\n/g, '\\n')
        });
        p.addRow({
            property: 'tables',
            value: entry.query.tables?.map((t) => t.schema_name + '.' + t.table_name).join(' ')
        });
        p.printTable();
        console.log('Query: ');
        console.log('```');
        printQuery(entry.query.query);
        console.log('```');

        // print separator
        console.log('------------------------------------------------------------');
    }
};

const historyListDoc = {
    description: 'Show the query history.',
    parameters: [],
    stdin: '',
    options: {
        format: 'choose the format of the response: text or json.',
        limit: 'choose how many items to list.',
        liked: 'only display liked queries'
    }
};

function stringToBoolean(str: string) {
    return /^(true|1|yes|y)$/i.test(str.trim());
}

const historyList = async (params: CmdParams) => {
    let limit = 10;
    if (params.opts['limit']) {
        limit = parseInt(params.opts['limit']);
    }
    let liked = false;
    if (params.opts['liked']) {
        liked = stringToBoolean(params.opts['liked']);
    }


    const result = await WAII.History.get({
        limit: limit,
        liked_query_filter: liked,
        included_types: ['query']
    });

    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        default: {
            if (!result.history) {
                throw new Error('No history found.');
            }
            printHistory(result.history as GeneratedQueryHistoryEntry[]);
        }
    }
};

const historyCommands = {
    list: { fn: historyList, doc: historyListDoc }
};

export { historyCommands };
