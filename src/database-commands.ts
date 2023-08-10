import WAII from '../../waii-sdk-js'
import { DBConnection, ModifyDBConnectionRequest } from "../../waii-sdk-js/clients/database/src/Database";
import { CmdParams } from './cmd-line-parser';

const printConnectors = (connectors: DBConnection[]) => {
    console.log("account, database, warehouse, role, user, key");
    for (const connection of connectors) {
        console.log(
            connection.account_name + ', ' +
            connection.database + ', ' +
            connection.warehouse + ', ' +
            connection.role + ', ' +
            connection.username + ', ' +
            connection.key + ', ');
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
                key: null,
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
    WAII.Database.activateConnection(params.vals[0]);
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
            }
            console.log("Database:\n---------");
            console.log(result.catalogs[0].schemas[0].name.database_name);
            console.log("\nSchemas:\n--------")
            for (const schema of result.catalogs[0].schemas) {
                console.log(schema.name.database_name + '.' + schema.name.schema_name + " (" + schema.tables.length + " tables)");
            }
        }
    }
}

const schemaDescribe = async (params: CmdParams) => {
    let result = await WAII.Database.getCatalogs();
    let schema = null;
    for (const s of result.catalogs[0].schemas) {
        if (s.name.schema_name == params.vals[0]) {
            schema = s;
        }
    }
    if (!schema) {
        console.error("Can't find schema: " + params.vals[0]);
        process.exit(-1);
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
            console.log(schema.description.summary);
            console.log("\nTables:\n-------")
            for (const table of schema.tables) {
                console.log(table.name.database_name + '.' + table.name.schema_name + '.' + table.name.table_name);
            }
            console.log("\nCommon Questions:\n-----------------");
            for (const q of schema.description.common_questions) {
                console.log(q);
            }
        }
    }
}

const tableDescribe = async (params: CmdParams) => {
    let result = await WAII.Database.getCatalogs();

    let schema = null;
    for (const s of result.catalogs[0].schemas) {
        if (params.vals[0].toLowerCase().startsWith(s.name.schema_name.toLowerCase())) {
            schema = s;
        }
    }

    let table = null;
    for (const t of schema.tables) {
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
            for (const column of table.columns) {
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
