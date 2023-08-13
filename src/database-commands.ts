import WAII from 'waii-sdk-js'
import { DBConnection } from "waii-sdk-js/dist/clients/database/src/Database";
import { CmdParams } from './cmd-line-parser';

import { Table } from 'console-table-printer';

const printConnectors = (connectors?: DBConnection[]) => {
    // Define the columns for the table, excluding the 'key' column
    const columns = [
        { name: 'account', title: 'account_name', alignment: 'left' },
        { name: 'database', title: 'database', alignment: 'left' },
        { name: 'warehouse', title: 'warehouse', alignment: 'left' },
        { name: 'role', title: 'role', alignment: 'left' },
        { name: 'user', title: 'username', alignment: 'left' }
    ];

    let default_scope = WAII.Database.getDefaultConnection()

    // If connectors are provided, iterate through them and create a table for each one
    if (connectors) {
        for (const connection of connectors) {
            // Create a new Table with the defined columns and the connection.key as the title
            let config = {}
            if (connection.key == default_scope) {
                config = { color: 'green' }
            }

            const p = new Table({ columns, title: connection.key });

            // Add the current connection to the table
            p.addRow({
                account: connection.account_name,
                database: connection.database,
                warehouse: connection.warehouse,
                role: connection.role,
                user: connection.username
            }, config);

            // Print the table
            p.printTable();

            console.log("\n")
        }
    }
}


const databaseList = async (params: CmdParams) => {
    let result = await WAII.Database.getConnections();
    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        default: {
            printConnectors(result.connectors);
        }
    }
}

const databaseDelete = async (params: CmdParams) => {
    let result = await WAII.Database.modifyConnections({ removed: [params.vals[0]] });
    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        default: {
            printConnectors(result.connectors);
        }
    }
}

const databaseAdd = async (params: CmdParams) => {
    let result = await WAII.Database.modifyConnections(
        {
            updated: [{
                key: '',
                account_name: params.opts['a'],
                database: params.opts['d'],
                warehouse: params.opts['w'],
                role: params.opts['r'],
                username: params.opts['u'],
                password: params.opts['p'],
                db_type: 'snowflake',
            }]
        }
    );
    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        default: {
            printConnectors(result.connectors);
        }
    }
}

const databaseActivate = async (params: CmdParams) => {
    await WAII.Database.activateConnection(params.vals[0]);
}

const databaseDescribe = async (params: CmdParams) => {
    let result = await WAII.Database.getCatalogs();
    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        default: {
            if (!result.catalogs || !result.catalogs[0].schemas) {
                console.log("Database is empty.");
                return;
            }
            console.log("Database:\n---------");
            console.log(result.catalogs[0].schemas[0].name.database_name);
            console.log("\nSchemas:\n--------")
            for (const schema of result.catalogs[0].schemas) {
                if (!schema.tables) schema.tables = [];
                console.log(schema.name.database_name + '.' + schema.name.schema_name + " (" + schema.tables.length + " tables)");
            }
        }
    }
}

const schemaDescribe = async (params: CmdParams) => {
    let result = await WAII.Database.getCatalogs();
    let schema = null;
    if (!result.catalogs || result.catalogs.length === 0) {
        console.log("No databases configured.");
        return;
    }
    if (!result.catalogs[0].schemas) {
        console.log("No schemas found");
        return;
    }
    for (const s of result.catalogs[0].schemas) {
        if (s.name.schema_name == params.vals[0]) {
            schema = s;
        }
    }
    if (!schema) {
        console.error("Can't find schema: " + params.vals[0]);
        return;
    }
    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(schema, null, 2));
            break;
        }
        default: {
            console.log("Schema:\n-------");
            console.log(schema.name.database_name + "." + schema.name.schema_name);
            console.log("\nDescription:\n------------");
            if (schema.description && schema.description.summary) {
                console.log(schema.description.summary);
                console.log("\nTables:\n-------")
            }
            if (schema.tables) {
                for (const table of schema.tables) {
                    console.log(table.name.database_name + '.' + table.name.schema_name + '.' + table.name.table_name);
                }
            }
            if (schema.description && schema.description.common_questions) {
                console.log("\nCommon Questions:\n-----------------");
                for (const q of schema.description.common_questions) {
                    console.log(q);
                }
            }
        }
    }
}

const tableDescribe = async (params: CmdParams) => {
    let result = await WAII.Database.getCatalogs();
    if (!result.catalogs || result.catalogs.length === 0) {
        console.log("No databases configured.");
        return;
    }

    if (!result.catalogs[0].schemas) {
        console.log("No schemas found.");
        return;
    }

    let schema = null;
    for (const s of result.catalogs[0].schemas) {
        if (params.vals[0].toLowerCase().startsWith(s.name.schema_name.toLowerCase())) {
            schema = s;
        }
    }

    if (!schema) {
        console.log("No matching schema found.");
        return;
    }

    let table = null;
    for (const t of (schema.tables ? schema.tables : [])) {
        if (!t.name.schema_name) t.name.schema_name = '';
        if (params.vals[0].toLocaleLowerCase() ===
            (t.name.schema_name.toLowerCase() + '.' + t.name.table_name.toLowerCase())) {
            table = t;
        }
    }

    if (!schema || !table) {
        console.error("Can't find table: " + params.vals[0]);
        process.exit(-1);
    }
    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(table, null, 2));
            break;
        }
        default: {
            console.log("Table:\n------");
            console.log(table.name.schema_name + "." + table.name.table_name);
            console.log("\nDescription:\n------------");
            console.log(table.description);
            console.log("\nColumns:\n--------")
            for (const column of (table.columns ? table.columns : [])) {
                console.log(column.name + ': ' + column.type);
            }
        }
    }
}

const databaseCommands = {
    list: databaseList,
    add: databaseAdd,
    delete: databaseDelete,
    activate: databaseActivate,
    describe: databaseDescribe,
};

const schemaCommands = {
    describe: schemaDescribe
};

const tableCommands = {
    describe: tableDescribe
}

export { databaseCommands, schemaCommands, tableCommands };
