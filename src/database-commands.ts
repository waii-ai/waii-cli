import WAII from 'waii-sdk-js'
import {Schema, SchemaDescription} from 'waii-sdk-js/dist/clients/database/src/Database';
import {DBConnection} from "waii-sdk-js/dist/clients/database/src/Database";
import {CmdParams} from './cmd-line-parser';
import {Table} from 'console-table-printer';

const printConnectors = (connectors?: DBConnection[]) => {
    // Define the columns for the table, excluding the 'key' column
    const columns = [
        {name: 'account', title: 'account_name', alignment: 'left'},
        {name: 'database', title: 'database', alignment: 'left'},
        {name: 'warehouse', title: 'warehouse', alignment: 'left'},
        {name: 'role', title: 'role', alignment: 'left'},
        {name: 'user', title: 'username', alignment: 'left'}
    ];

    let default_scope = WAII.Database.getDefaultConnection()

    // If connectors are provided, iterate through them and create a table for each one
    if (connectors) {
        for (const connection of connectors) {
            // Create a new Table with the defined columns and the connection.key as the title
            let config = {}
            if (connection.key == default_scope) {
                config = {color: 'green'}
            }

            const p = new Table({columns, title: connection.key});

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
    let result = await WAII.Database.modifyConnections({removed: [params.vals[0]]});
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

            // print table of database
            const p_table = new Table({
                columns: [
                    {name: 'database', title: 'database', alignment: 'left'},
                ]
            });
            p_table.addRow({
                    database: result.catalogs[0].schemas[0].name.database_name,
                }
            );
            p_table.printTable();

            // print table of schemas

            const p = new Table({
                columns: [
                    {name: 'schema', title: 'schema', alignment: 'left'},
                    {name: 'tables', title: 'tables', alignment: 'left'},
                ]
            });
            for (const schema of result.catalogs[0].schemas) {
                if (!schema.tables) schema.tables = [];
                p.addRow({
                    schema: schema.name.database_name + '.' + schema.name.schema_name,
                    tables: schema.tables.length,
                });
            }
            p.printTable();
        }
    }
}

const schemaList = async (params: CmdParams) => {
    let result = await WAII.Database.getCatalogs();
    if (!result.catalogs || result.catalogs.length === 0) {
        console.log("No databases configured.");
        return;
    }
    if (!result.catalogs[0].schemas) {
        console.log("No schemas found");
        return;
    }
    switch (params.opts['format']) {
        case 'json': {
            console.log("JSON format not yet implemented.");
        }
        default: {
            const p = new Table({
                columns: [
                    {name: 'schema', title: 'schema', alignment: 'left'},
                    {name: 'tables', title: 'tables', alignment: 'left'},
                ]
            });
            for (const schema of result.catalogs[0].schemas) {
                if (!schema.tables) schema.tables = [];
                p.addRow({
                    schema: schema.name.database_name + '.' + schema.name.schema_name,
                    tables: schema.tables.length,
                });
            }
            p.printTable();
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

    // schema name to describe
    let target_schema_name = params.vals[0]
    // if target schema name includes ".", get schema name from it (last element)
    if (target_schema_name.includes(".")) {
        let arr = target_schema_name.split(".")
        target_schema_name = arr[arr.length - 1]
    }

    for (const s of result.catalogs[0].schemas) {
        if (s.name.schema_name.toLowerCase() == target_schema_name.toLowerCase()) {
            schema = s;
        }
    }
    if (!schema) {
        console.error("Can't find schema: " + target_schema_name);
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
                const p = new Table({
                    columns: [
                        {name: 'table', title: 'table', alignment: 'left'},
                    ]
                });
                for (const table of schema.tables) {
                    p.addRow({
                        table: table.name.table_name,
                    });
                }
                p.printTable();
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

function getTerminalWidth(): number {
    return process.stdout.columns || 80; // Fallback to 80 if undefined
}

function formatStrings(list: string[]): string {
    const terminalWidth = getTerminalWidth(); // Fallback to 80 if undefined
    const maxLength = Math.max(...list.map(item => item.length)) + 2; // 2 spaces between columns
    const columns = Math.floor(terminalWidth / maxLength);
    const rows = Math.ceil(list.length / columns);

    let output = '';
    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
            const index = column + row * columns;
            if (index < list.length) {
                const item = list[index];
                output += item.padEnd(maxLength);
            }
        }
        output += '\n';
    }

    return output;
}


const tableList = async (params: CmdParams) => {
    let result = await WAII.Database.getCatalogs();
    if (!result.catalogs || result.catalogs.length === 0) {
        console.log("No databases configured.");
        return;
    }

    if (!result.catalogs[0].schemas) {
        console.log("No tables found.");
        return;
    }

    switch (params.opts['format']) {
        case 'json': {
            console.log("JSON format not yet implemented.");
        }
        default: {
            for (const schema of result.catalogs[0].schemas) {
                let tables = []
                for (const table of (schema.tables ? schema.tables : [])) {
                    tables.push(table.name.table_name)
                }
                let t_s = formatStrings(tables)
                const p_s = new Table({
                    columns: [
                        {name: 'table', title: schema.name.schema_name, alignment: 'left'},
                    ],
                })
                // split t_s by '\n', and add row
                for (const t of t_s.split('\n')) {
                    p_s.addRow({
                        table: t,
                    })
                }
                p_s.printTable()
            }
        }
    }
}

const tableDescribe = async (params: CmdParams) => {
    // params.vals[0] is table name, which can be <db_name>.<schema_name>.<table_name>, or <schema_name>.<table_name> or <table_name>
    // if any of db_name or schema_name is not provided, use default db_name and schema_name (*)
    let db_name = '*'
    let schema_name = '*'
    let table_name = params.vals[0]
    if (table_name.includes(".")) {
        let arr = table_name.split(".")
        if (arr.length == 3) {
            db_name = arr[0]
            schema_name = arr[1]
            table_name = arr[2]
        } else if (arr.length == 2) {
            schema_name = arr[0]
            table_name = arr[1]
        } else {
            table_name = arr[0]
        }
    }

    let result = await WAII.Database.getCatalogs();
    if (!result.catalogs || result.catalogs.length === 0) {
        console.log("No databases configured.");
        return;
    }

    if (!result.catalogs[0].schemas) {
        console.log("No schemas found.");
        return;
    }
    let tables = []
    for (const schema of result.catalogs[0].schemas) {
        for (const table of (schema.tables ? schema.tables : [])) {
            // try to match table, db and schema name
            if (table.name.table_name.toLowerCase() == table_name.toLowerCase() &&
                (db_name == '*' || (table.name.database_name && table.name.database_name.toLowerCase() == db_name.toLowerCase())) &&
                (schema_name == '*' || (table.name.schema_name && table.name.schema_name.toLowerCase() == schema_name.toLowerCase()))) {
                tables.push(table)
            }
        }
    }

    if (tables.length > 1) {
        console.error("Too many tables found. Please specify the schema_name too. Tables=[" + tables.map((t) => t.name.schema_name + "." + t.name.table_name).join(", ") + "]")
        process.exit(-1)
    }

    if (tables.length == 0) {
        console.error("Can't find table: " + params.vals[0]);
        process.exit(-1);
    }
    for (const table of tables) {
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
                const p = new Table({
                    columns: [
                        {name: 'column', title: 'column', alignment: 'left'},
                        {name: 'type', title: 'type', alignment: 'left'},
                    ]
                });
                for (const column of (table.columns ? table.columns : [])) {
                    p.addRow({
                        column: column.name,
                        type: column.type,
                    });
                }
                p.printTable();
            }
        }
    }
}

const updateTableDescription = async (params: CmdParams) => {
    let table_name = params.vals[0]
    let description = params.vals[1]
    if (!table_name || !description) {
        console.error("table_name and description are required")
        process.exit(-1)
    }

    // use "." to split table_name into db_name, schema_name and table_name
    let arr = table_name.split(".")
    if (arr.length != 3) {
        console.error("table_name should be <db_name>.<schema_name>.<table_name>")
        process.exit(-1)
    }

    await WAII.Database.updateTableDescription({
        description: description,
        table_name: {
            table_name: arr[2],
            schema_name: arr[1],
            database_name: arr[0]
        }
    })
}

const schemaUpdateDescription = async (params: CmdParams) => {
    let name = params.vals[0];
    let description = params.vals[1];
    let schema_name = null;
    let database_name = null;

    if (!schema_name || !description) {
        console.error("database name, schema_name and description are required");
        process.exit(-1);
    }

    // if target schema name includes ".", get schema name from it (last element)
    if (name.includes(".")) {
        let arr = name.split(".");
        if (arr.length != 2) {
            console.error("name given is not of the form <db name>.<schema name>");
            process.exit(-1);
        }
        schema_name = arr[1];
        database_name = arr[0];
    }

    if (!database_name || !schema_name) {
        console.error("Incorrect name, need <db name>.<schema name>");
        process.exit(-1);
    }

    await WAII.Database.updateSchemaDescription({
        description: JSON.parse(description),
        schema_name: {
            schema_name: schema_name,
            database_name: database_name
        }
    });
}

const getDBName = (name: string): string => {
    if (!name) {
        console.error("Invalid name: ", name);
        process.exit(-1);
    }
    return name.split('.')[0];
}

const getSchemaName = (name: string): string => {
    if (!name) {
        console.error("Invalid name: ", name);
        process.exit(-1);
    }

    if (name.split('.').length < 2) {
        console.error("Invalid name: ", name);
    }
    return name.split('.')[1];
}

const findSchema = async (name: string):Promise<Schema> => {

    let result = await WAII.Database.getCatalogs();
    if (!result.catalogs || result.catalogs.length === 0) {
        console.log("No databases configured.");
        process.exit(-1);
    }
    if (!result.catalogs[0].schemas) {
        console.log("No schemas found");
        process.exit(-1);
    }

    let schema = null;
    for (const s of result.catalogs[0].schemas) {
        if (s.name.schema_name.toLowerCase() == name.toLowerCase()) {
            schema = s;
        }
    }
    if (!schema) {
        console.error("Can't find schema: " + name);
        process.exit(-1);
    }
    return schema;
}

const schemaUpdateQuestions = async (params: CmdParams) => {
    let name = params.vals[0];
    let database_name = getDBName(name);
    let schema_name = getSchemaName(name);

    let questions = params.vals.slice(1);

    if (questions.length !== 3) {
        console.error("Need exactly 3 questions.");
        process.exit(-1);
    }

    let schema : Schema = await findSchema(schema_name);
    
    let description = schema.description;
    if (!description) {
        description = {};
    }

    description.common_questions = questions;

    await WAII.Database.updateSchemaDescription({
        description: description,
        schema_name: {
            schema_name: schema_name,
            database_name: database_name
        }
    });
}

const schemaUpdateSummary = async (params: CmdParams) => {
    let name = params.vals[0];
    let database_name = getDBName(name);
    let schema_name = getSchemaName(name);
    
    let summary = params.vals[1];

    if (!summary) {
        console.error("Need valid summary.");
        process.exit(-1);
    }

    let schema : Schema = await findSchema(schema_name);
    
    let description = schema.description;
    if (!description) {
        description = {};
    }

    description.summary = summary;

    await WAII.Database.updateSchemaDescription({
        description: description,
        schema_name: {
            schema_name: schema_name,
            database_name: database_name
        }
    });
}

const databaseCommands = {
    list: databaseList,
    add: databaseAdd,
    delete: databaseDelete,
    activate: databaseActivate,
    describe: databaseDescribe,
};

const schemaCommands = {
    describe: schemaDescribe,
    list: schemaList,
    update: schemaUpdateDescription,
    update_questions: schemaUpdateQuestions,
    update_summary: schemaUpdateSummary
};

const tableCommands = {
    describe: tableDescribe,
    list: tableList,
    update: updateTableDescription
}

export {databaseCommands, schemaCommands, tableCommands};
