import WAII, { Waii } from 'waii-sdk-js'
import * as readline from 'readline';
import {
    DBContentFilterActionType, DocumentContentType,
    Schema,
    SchemaName, SearchContext,
    TableName
} from 'waii-sdk-js/dist/clients/database/src/Database';
import {
    DBConnection,
    DBConnectionIndexingStatus,
    DBContentFilter,
    DBContentFilterScope,
    DBContentFilterType
} from "waii-sdk-js/dist/clients/database/src/Database";
import { ArgumentError, CmdParams } from './cmd-line-parser';
import { queryCommands } from './query-commands';
import { Table } from 'console-table-printer';
import SemanticContext, {SemanticStatement} from "waii-sdk-js/dist/clients/semantic-context/src/SemanticContext";
import { WaiiRoles, ROLE_RANKS, WaiiPermissions } from './common'
import { UserModel } from './user-commands'

let rl: readline.ReadLine | null = null;

function createInterface() {
    if (!rl) {
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
    }
    return rl;
}

function closeInterface() {
    if (rl) {
        rl.close();
        rl = null;
    }
}

function prompt(message: string): Promise<string> {
    rl = createInterface();
    return new Promise<string>((resolve) => {
        rl?.question(message, (answer: string) => {
            resolve(answer);
        });
    });
}

const printConnectionSelector = (connectors?: DBConnection[]) => {
    let defaultScope = WAII.Database.getDefaultConnection();

    if (connectors) {
        for (let i = 0; i < connectors.length; ++i) {
            let connection = connectors[i];

            const connectionToPrint = "[ " + (i + 1) + " ] " + connection.key

            // for default connection, print in green color
            if (connection.key == defaultScope) {
                console.log("\x1b[32m%s\x1b[0m", connectionToPrint + " [Active]");
            } else {
                console.log(connectionToPrint);
            }
        }
    }
}

const printConnectors = (connectors?: DBConnection[], status?: {
    [key: string]: DBConnectionIndexingStatus;
}, dbToUserMap?: Map<string, UserModel[]>) => {

    let defaultScope = WAII.Database.getDefaultConnection();

    console.log();

    // If connectors are provided, iterate through them and create a table for each one
    if (connectors) {
        for (const connection of connectors) {

            let dbColumns = [];
            let dbRow: { [a: string]: string } = {}

            if (connection.account_name) {
                dbColumns.push({ name: 'account', title: 'account_name', alignment: 'left' });
                dbRow['account'] = connection.account_name;
            }

            if (connection.database) {
                dbColumns.push({ name: 'database', title: 'database', alignment: 'left' });
                dbRow['database'] = connection.database;
            }

            if (connection.warehouse) {
                dbColumns.push({ name: 'warehouse', title: 'warehouse', alignment: 'left' });
                dbRow['warehouse'] = connection.warehouse;
            }

            if (connection.role) {
                dbColumns.push({ name: 'role', title: 'role', alignment: 'left' });
                dbRow['role'] = connection.role;
            }

            if (connection.username) {
                dbColumns.push({ name: 'user', title: 'username', alignment: 'left' });
                dbRow['user'] = connection.username;
            }

            let p = new Table({ columns: dbColumns });
            p.addRow(dbRow);

            let userColumns = [
                {name: 'user_id', title: 'user_id', alignment: 'left'},
                {name: 'tenant_id', title: 'tenant_id', alignment: 'left'},
                {name: 'org_id', title: 'org_id', alignment: 'left'}
            ];
            
            let usersTable = new Table({columns: userColumns})

            if(dbToUserMap) {
                let usersForDB = dbToUserMap.get(connection.key)
                if(usersForDB) {
                    for(let user of usersForDB) {
                        let userRow: { [a: string]: string } = {}
                        userRow['user_id'] = user.id;
                        if(user.org_id) {
                            userRow['org_id'] = user.org_id;
                        }
                        if(user.tenant_id)  {
                            userRow['tenant_id'] = user.tenant_id;
                        }
                        usersTable.addRow(userRow)
                    }
                }
            }
            

            try {
                let percentage = 1;

                if (status) {
                    let total = 0;
                    let pending = 0;
                    let db_status = status[connection.key];

                    if (db_status && db_status.schema_status) {
                        for (const schema in db_status.schema_status) {
                            let schema_status = db_status.schema_status[schema];
                            total += schema_status.n_total_tables;
                            pending += schema_status.n_pending_indexing_tables;
                        }
                    }

                    let denoTotal = db_status && db_status.status === 'indexing' ? total + 5 : total;
                    percentage = (total > 0) ? (total - pending) / denoTotal : 1;
                }

                if (connection.key == defaultScope) {
                    console.log("\x1b[32m%s\x1b[0m", "Key: " + connection.key + " [Active]");
                } else {
                    console.log("Key: " + connection.key);
                }

                // Check status for specific connection key and display indexing status
                if (status && status[connection.key]) {
                    let status_string = status[connection.key].status;
                    console.log("Indexing status: " + status_string);
                    if (status_string === "indexing") {
                        console.log("Percent complete: " + `${Math.round(percentage * 100 * 100) / 100}%`);
                    }
                } else {
                    console.log("Status information for connection key is not available.");
                }
            } catch (error) {
                console.error("An error occurred while processing the status data:");
                if (error instanceof Error) {
                    console.error("Error message:", error.message);
                    console.error("Stack trace:", error.stack);
                } else {
                    console.error("Unknown error type:", error);
                }
            }

            // Print the table
            p.printTable();
            // print users table only if databases are being printed for multiple users
            if(dbToUserMap) {
                usersTable.printTable();
            }

            console.log("\n")
        }
    }
}

const getOrgDBInfo = async (dbToUserMap: Map<string, UserModel[]>, dbMap: Map<string, DBConnection>, status: {
    [key: string]: DBConnectionIndexingStatus
}, currentUserId: string, checkRole: string, org_id?: string) => {
    let otherAdmins = 0;
    let users = await WAII.User.listUsers({
        lookup_org_id: org_id
    });
    for(let user of users.users) {
        let skipUser = false;
        if(user.roles) {
            for(let role of user.roles) {
                if(role === checkRole && user.id !== currentUserId) {
                    skipUser = true;
                    otherAdmins += 1;
                }
            }
        }
        if(skipUser) {
            continue;
        }

        if(user.id === currentUserId) {
            var result = await WAII.Database.getConnections({});
        } else {
            WAII.HttpClient.setImpersonateUserId(user.id)
            var result = await WAII.Database.getConnections({});
            WAII.HttpClient.setImpersonateUserId(null)
        }
        if(result.connectors) {
            for(let conn of result.connectors) {
                if(!dbMap.has(conn.key)) {
                    dbMap.set(conn.key, conn);
                }
                if(!dbToUserMap.has(conn.key)) {
                    dbToUserMap.set(conn.key, []);
                }
                dbToUserMap.set(conn.key, dbToUserMap.get(conn.key)!.concat(user));
            };
        }
        if(result.connector_status) {
            for (const [key, value] of Object.entries(result.connector_status)) {
                status[key] = value; 
            }
        }

    }
    return otherAdmins;
}

const databaseListDoc = {
    description: "List all the configured databases.",
    parameters: [],
    stdin: "",
    options: {
        format: "choose the format of the response: text or json.",
    },
    examples: `Example: List all databases
<code>waii database list</code>

<code>
┌──────────────────┬────────────────────┬────────────┬───────────────────┬──────────────┐
│ account_name     │ database           │ warehouse  │ role              │ username     │
├──────────────────┼────────────────────┼────────────┼───────────────────┼──────────────┤
│ gq.........91428 │ TWEAKIT_PLAYGROUND │ COMPUTE_WH │ TWEAKIT_USER_ROLE │ TWEAKIT_USER │
└──────────────────┴────────────────────┴────────────┴───────────────────┴──────────────┘
</code>`
};
const databaseList = async (params: CmdParams) => {
    let userInfo = await WAII.User.getInfo({});
    if('all_users' in  params.opts) {
        let currentUserRole = userInfo.roles[0];
        for(const role in userInfo.roles) {
            if(ROLE_RANKS[role] > ROLE_RANKS[currentUserRole]) {
                currentUserRole = role;
            }
        }
        
        switch(currentUserRole) {
            case WaiiRoles.WAII_SUPER_ADMIN_USER: {
                let dbToUserMap = new Map<string, UserModel[]>();
                let dbMap = new Map<string, DBConnection>();
                let otherSuperAdmins = 0;
                let status: {
                    [key: string]: DBConnectionIndexingStatus
                } = {};
                let orgsInfo = await WAII.User.listOrganizations({});
                for(const org of orgsInfo.organizations) {
                    otherSuperAdmins += await getOrgDBInfo(dbToUserMap, dbMap, status, userInfo.id, WaiiRoles.WAII_SUPER_ADMIN_USER, org.id);
                }
                printConnectors(Array.from(dbMap.values()), status, dbToUserMap);
                if(otherSuperAdmins !== 0) {
                    console.log(`Skipped Database connections of ${otherSuperAdmins} other super admins`)
                }
                break;
            }
            case WaiiRoles.WAII_ORG_ADMIN_USER: {
                let dbToUserMap = new Map<string, UserModel[]>();
                let dbMap = new Map<string, DBConnection>();
                let otherOrgAdmins = 0;
                let status: {
                    [key: string]: DBConnectionIndexingStatus
                } = {};
                otherOrgAdmins = await getOrgDBInfo(dbToUserMap, dbMap, status, userInfo.id, WaiiRoles.WAII_ORG_ADMIN_USER);
                printConnectors(Array.from(dbMap.values()), status, dbToUserMap);
                if(otherOrgAdmins !== 0) {
                    console.log(`Skipped Database connections of ${otherOrgAdmins} other org admins`)
                }
                break;
            }
            default: {
                console.log('unauthorized to view other users\' database connections')
                break;
            }
        }
    } else {
        if('user_id' in params.opts) {
            if(userInfo.permissions.indexOf(WaiiPermissions.USAGE_IMPERSONATION) > -1) {
                let impersonationUserId = params.opts['user_id']
                WAII.HttpClient.setImpersonateUserId(impersonationUserId);
            } else {
                console.error('You do not have permissions to impersonate other users. Unset user_id flag')
                return;
            }
        }
        let result = await WAII.Database.getConnections();
        switch (params.opts['format']) {
            case 'json': {
                console.log(JSON.stringify(result, null, 2));
                break;
            }
            default: {
                printConnectors(result.connectors, result.connector_status);
            }
        }

    }
}

const databaseDeleteDoc = {
    description: "Delete a database connection.",
    parameters: ["url - the database key to be deleted."],
    stdin: "",
    options: {
        format: "choose the format of the response: text or json.",
    }
};

const getDBConnectionKeyIfNotProvided = async (params: CmdParams, action: string) => {
    if (params.vals.length === 0) {
        // first get all connections
        let result = await WAII.Database.getConnections();

        if (!result.connectors || result.connectors.length === 0) {
            throw new Error("No databases connection configured.");
        }

        // print all connections
        printConnectionSelector(result.connectors);

        // print a msg and read from stdin
        console.log("Please enter the index of the database connection to " + action + " (specify 1-N):");
        let stdin = process.openStdin();
        let listener;
        let id = await new Promise<number>((resolve, reject) => {
            listener = (d: any) => {
                let input = d.toString().trim();
                if (input === "q") {
                    reject("User canceled");
                }
                let num = Number(input);
                if (isNaN(num)) {
                    console.log("Please enter a number:");
                } else {
                    resolve(num);
                };
            };
            stdin.addListener("data", listener);
        });
        stdin.removeAllListeners();
        process.stdin.destroy();
        // check if the number within the range
        if (id < 1 || id > result.connectors.length) {
            throw new Error("Index out of range");
        }

        params.vals.push(result.connectors[id - 1].key);
    }
}

async function confirmDelete(): Promise<boolean> {
    const answer = await prompt(`Are you sure you want to delete the above databases ([y/n])?: `);
    closeInterface();
    return answer.toLowerCase() === 'y'; // Check for 'y' or 'Y'
}

const databaseDelete = async (params: CmdParams) => {
    let userInfo = await WAII.User.getInfo({});
    if('all_users' in  params.opts) {
        let currentUserRole = userInfo.roles[0];
        for(const role in userInfo.roles) {
            if(ROLE_RANKS[role] > ROLE_RANKS[currentUserRole]) {
                currentUserRole = role;
            }
        }
        
        switch(currentUserRole) {
            case WaiiRoles.WAII_SUPER_ADMIN_USER: {
                let dbToUserMap = new Map<string, UserModel[]>();
                let dbMap = new Map<string, DBConnection>();
                let otherSuperAdmins = 0;
                let status: {
                    [key: string]: DBConnectionIndexingStatus
                } = {};
                let orgsInfo = await WAII.User.listOrganizations({});
                for(const org of orgsInfo.organizations) {
                    otherSuperAdmins += await getOrgDBInfo(dbToUserMap, dbMap, status, userInfo.id, WaiiRoles.WAII_SUPER_ADMIN_USER, org.id);
                }
                printConnectors(Array.from(dbMap.values()), status, dbToUserMap);
                if(otherSuperAdmins !== 0) {
                    console.log(`Skipped Database connections of ${otherSuperAdmins} other super admins`)
                }
                const confirmed = await confirmDelete();
                if (confirmed) {
                    console.log("Deleting databases...");
                    let userToDB = new Map<string, string[]>();
                    for(const [key, value] of dbToUserMap) {
                        for(const user of value) {
                            if(!userToDB.has(user.id)) {
                                userToDB.set(user.id, []);
                            }
                            userToDB.set(user.id, userToDB.get(user.id)!.concat(key))
                        }
                    }
                    for(const [key, value] of userToDB) {
                        if(key === userInfo.id) {
                            var result = await WAII.Database.modifyConnections({removed: value})
                        } else {
                            WAII.HttpClient.setImpersonateUserId(key)
                            var result = await WAII.Database.modifyConnections({removed: value})
                            WAII.HttpClient.setImpersonateUserId(null)
                        }
                    }
                } else {
                    console.log("Deletion cancelled.");
                }
                break;
            }
            case WaiiRoles.WAII_ORG_ADMIN_USER: {
                let dbToUserMap = new Map<string, UserModel[]>();
                let dbMap = new Map<string, DBConnection>();
                let otherOrgAdmins = 0;
                let status: {
                    [key: string]: DBConnectionIndexingStatus
                } = {};
                otherOrgAdmins = await getOrgDBInfo(dbToUserMap, dbMap, status, userInfo.id, WaiiRoles.WAII_ORG_ADMIN_USER);
                printConnectors(Array.from(dbMap.values()), status, dbToUserMap);
                if(otherOrgAdmins !== 0) {
                    console.log(`Skipped Database connections of ${otherOrgAdmins} other org admins`)
                }
                const confirmed = await confirmDelete();
                if (confirmed) {
                    // postgresql://waii@localhost:5432/waii_sdk_test
                    console.log("Deleting databases...");
                    let userToDB = new Map<string, string[]>();
                    for(const [key, value] of dbToUserMap) {
                        for(const user of value) {
                            if(!userToDB.has(user.id)) {
                                userToDB.set(user.id, []);
                            }
                            userToDB.set(user.id, userToDB.get(user.id)!.concat(key))
                        }
                    }
                    for(const [key, value] of userToDB) {
                        WAII.HttpClient.setImpersonateUserId(key)
                        let result = await WAII.Database.modifyConnections({removed: value})
                        WAII.HttpClient.setImpersonateUserId(null)
                        switch (params.opts['format']) {
                            case 'json': {
                                console.log(JSON.stringify(result, null, 2));
                                break;
                            }
                            default: {
                                printConnectors(result.connectors, result.connector_status);
                            }
                        }
                    }
                } else {
                    console.log("Deletion cancelled.");
                }
                break;
            }
            default: {
                console.log('unauthorized to view other users\' database connections')
                break;
            }
        }
    } else {
        if('user_id' in params.opts) {
            if(userInfo.permissions.indexOf(WaiiPermissions.USAGE_IMPERSONATION) > -1) {
                let impersonationUserId = params.opts['user_id']
                WAII.HttpClient.setImpersonateUserId(impersonationUserId);
            } else {
                console.error('You do not have permissions to impersonate other users. Unset user_id flag')
                return;
            }
        }
        await getDBConnectionKeyIfNotProvided(params, 'delete');
    
        let result = await WAII.Database.modifyConnections({ removed: [params.vals[0]] });
        switch (params.opts['format']) {
            case 'json': {
                console.log(JSON.stringify(result, null, 2));
                break;
            }
            default: {
                printConnectors(result.connectors, result.connector_status);
            }
        }
    }
}

const databaseAddDoc = {
    description: "Add a database connection.",
    parameters: [],
    stdin: "",
    options: {
        format: "choose the format of the response: text or json.",
        connect_string: "specify connection string instead of individual fields",
        account: "account name",
        db: "database name",
        warehouse: "warehouse name",
        role: "role name",
        user: "user name",
        pass: "password",
        no_column_samples: "if set, will not sample columns",
        exclude_columns: "don't index columns matching this pattern",
        exclude_tables: "don't index tables matching this pattern",
        exclude_schemas: "don't index schemas matching this pattern",
        exclude_columns_for_sampling: "don't sample columns matching this pattern",
        exclude_tables_for_sampling: "don't sample tables matching this pattern",
        exclude_schemas_for_sampling: "don't sample schemas matching this pattern",
    },
    examples: `Example: Add a snowflake database
<code>waii database add --account 'xxxxx-yyyyy' --db '<DB>' --warehouse '<COMPUTE_WH>' --role '<YOUR_SNOWFLAKE_ROLE>' --user '<YOUR_SNOWFLAKE_USER>' --pass '********'</code>

Other parameters:
- \`no_column_samples\`: If set to \`true\`, the column samples will not be fetched. Default is \`false\`.
- You can also use \`exclude_columns_for_sampling\`, \`exclude_tables_for_sampling\`, \`exclude_schemas_for_sampling\` to exclude some tables, columns, schemas from sampling.
- You can add multiple patterns, e.g.

<code>
--exclude_columns_for_sampling ".*name.*" --exclude_columns_for_sampling ".*bio.*" --exclude_columns_for_sampling ".*year" --exclude_tables_for_sampling "tv_series"
</code>

It will exclude all columns contain \`name\`, \`bio\`, \`year\` in their names, and exclude table \`tv_series\`.`
};

const _addColFilterForSampling = (filters: DBContentFilter[], params: CmdParams, opt_name: string, filter_scope: DBContentFilterScope) => {
    if (params.opts[opt_name]) {
        let excluded_cols = []

        if (!Array.isArray(params.opts[opt_name])) {
            excluded_cols.push(params.opts[opt_name])
        } else {
            excluded_cols = params.opts[opt_name]
        }

        for (let pattern of excluded_cols) {
            filters.push({
                filter_scope: filter_scope,
                filter_type: DBContentFilterType.exclude,
                ignore_case: true,
                pattern: pattern,
                filter_action_type: DBContentFilterActionType.sample_values
            })
        }
    }
}

const databaseAdd = async (params: CmdParams) => {
    let parameters = {
        config_file: undefined
    }

    let filters: DBContentFilter[] = []
    if (params.opts['exclude_columns']) {
        filters.push({
            filter_scope: DBContentFilterScope.column,
            filter_type: DBContentFilterType.exclude,
            ignore_case: true,
            pattern: params.opts['exclude_columns']

        })
    }

    if (params.opts['exclude_tables']) {
        filters.push({
            filter_scope: DBContentFilterScope.table,
            filter_type: DBContentFilterType.exclude,
            ignore_case: true,
            pattern: params.opts['exclude_tables']

        })
    }

    if (params.opts['exclude_schemas']) {
        filters.push({
            filter_scope: DBContentFilterScope.schema,
            filter_type: DBContentFilterType.exclude,
            ignore_case: true,
            pattern: params.opts['exclude_schemas']

        })
    }

    _addColFilterForSampling(filters, params, 'exclude_columns_for_sampling', DBContentFilterScope.column)
    _addColFilterForSampling(filters, params, 'exclude_tables_for_sampling', DBContentFilterScope.table)
    _addColFilterForSampling(filters, params, 'exclude_schemas_for_sampling', DBContentFilterScope.schema)

    let connect_string = params.opts['connect_string']
    if (connect_string) {
        // parse it to URI
        let uri = require('uri-js');
        let parsed = uri.parse(connect_string);
        if (!parsed) {
            throw new Error("Provided connect_string is not valid");
        }
        // check the following parameters, scheme, user, password, host, port, path, query and fragment
        if (parsed.scheme) {
            // check if db_type is different from scheme
            if (params.opts['db_type'] && params.opts['db_type'] != parsed.scheme) {
                throw new Error("db_type is different from scheme in connect_string");
            }
            params.opts['db_type'] = parsed.scheme;
        }
        if (parsed.userinfo) {
            let userinfo_arr = parsed.userinfo.split(":");
            if (userinfo_arr.length > 0) {
                if (params.opts['user'] && params.opts['user'] != userinfo_arr[0]) {
                    throw new Error("user is different from user in connect_string");
                }
                params.opts['user'] = userinfo_arr[0];
            }
            if (userinfo_arr.length > 1) {
                if (params.opts['pass'] && params.opts['pass'] != userinfo_arr[1]) {
                    throw new Error("pass is different from password in connect_string");
                }
                params.opts['pass'] = userinfo_arr[1];
            }
        }
        if (parsed.host) {
            if (params.opts['host'] && params.opts['host'] != parsed.host) {
                throw new Error("host is different from host in connect_string");
            }
            params.opts['host'] = parsed.host;
        }
        if (parsed.port) {
            if (params.opts['port'] && params.opts['port'] != parsed.port) {
                throw new Error("port is different from port in connect_string");
            }
            params.opts['port'] = parsed.port;
        }
        // check database, which is first element in path
        if (parsed.path) {
            let path = parsed.path.split("/");
            if (path.length > 1) {
                if (params.opts['db'] && params.opts['db'] != path[1]) {
                    throw new Error("db is different from database in connect_string");
                }
                params.opts['db'] = path[1];
            }
        }
    }

    let db_type = params.opts['db_type']
    if (!db_type) {
        db_type = 'snowflake'
    }

    if (db_type === 'mongo-migration') {
        // get config file
        let config_file = params.opts['config_file']
        if (!config_file) {
            throw new Error("config_file is required for mongo_migration");
        }
        // read content of the file
        let fs = require('fs');
        let config_content = fs.readFileSync(config_file, 'utf8');
        if (!config_content || config_content.length == 0) {
            throw new Error("config_file is empty");
        }
        // Try to parse it to json
        try {
            JSON.parse(config_content);
        } catch (e) {
            throw new Error("config_file is not valid json");
        }
        // if all passes, put the file content into parameters
        parameters.config_file = config_content;
        params.opts['path'] = config_file;

        // also set file name of config_file to database name
        let cfgFileName = config_file.split("/").pop();
        if (!cfgFileName) {
            cfgFileName = "config.json";
        }
        params.opts['db'] = cfgFileName;
    } else if (db_type === 'snowflake') {
        // check the following parameters
        let account = params.opts['account']
        let db = params.opts['db']
        let warehouse = params.opts['warehouse']
        let role = params.opts['role']
        let user = params.opts['user']
        let pass = params.opts['pass']
        if (!account || !db || !warehouse || !role || !user || !pass) {
            throw new Error("account, db, warehouse, role, user and pass are required for snowflake");
        }
    } else if (db_type === "postgresql" || db_type === "mongodb" || db_type === "mongodb+srv") {
        // check the following parameters
        let host = params.opts['host']
        let db = params.opts['db']
        if (!host || !db) {
            throw new Error("host and db are required for " + db_type);
        }
    }

    let db_conn: DBConnection = {
        key: '',
        db_type: db_type,
        account_name: params.opts['account'],
        database: params.opts['db'],
        warehouse: params.opts['warehouse'],
        role: params.opts['role'],
        username: params.opts['user'],
        password: params.opts['pass'],
        path: params.opts['path'],
        host: params.opts['host'],
        port: Number(params.opts['port']),
        parameters: parameters,
        sample_col_values: params.opts['no_column_samples'] ? false : true,
        db_content_filters: filters
    };

    let result = await WAII.Database.modifyConnections(
        {
            updated: [db_conn]
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

const databaseActivateDoc = {
    description: "Activate a database for use in generating queries and getting table information.",
    parameters: ["url - URL of the database to activate (can be found by running 'waii database list')"],
    stdin: "",
    options: {},
    examples: `Example: Activate a database
<code>waii database activate <url_of_the_database></code>

Note: The URL can be found by running 'waii database list'`
};
const databaseActivate = async (params: CmdParams) => {
    await getDBConnectionKeyIfNotProvided(params, 'activate');

    await WAII.Database.activateConnection(params.vals[0]);

    // use databaseList to check if the connection is activated
    let waitTime = 30;
    while (waitTime > 0) {
        let result = await WAII.Database.getConnections();
        if (result.default_db_connection_key === params.vals[0]) {
            // output in green color
            console.log("\x1b[32m%s\x1b[0m", "Database connection activated.");
            return
        }
        waitTime--;
        let timer;
        await new Promise(resolve => { timer = setTimeout(resolve, 1000) });
        clearTimeout(timer);
    }
    throw new Error("Failed to activate database connection after " + waitTime + " seconds.");
}

const databaseDescribeDoc = {
    description: "Describe the current database.",
    parameters: [],
    stdin: "",
    options: {
        format: "choose the format of the response: text or json.",
    }
};
const databaseDescribe = async (params: CmdParams) => {
    let result = await WAII.Database.getCatalogs();
    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(result, null, 2));
            break;
        }
        default: {
            if (!result.catalogs || !result.catalogs[0].schemas) {
                throw new Error("Database is empty.");
            }

            // print table of database
            const p_table = new Table({
                columns: [
                    { name: 'database', title: 'database', alignment: 'left' },
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
                    { name: 'schema', title: 'schema', alignment: 'left' },
                    { name: 'tables', title: 'tables', alignment: 'left' },
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

const extractDoc = {
    description: "Extract database documentation.",
    parameters: [],
    stdin: "",
    options: {
        url: "Web URL to extract documentation from.",
        file: "File path to extract documentation from.",
        doc_type: "Content type of the file, text/html, etc.",
        schemas: "Comma separated list of schemas to extract documentation from. If not provided, will search in all schemas.",
        tables: "Comma separated list of tables to extract documentation from. If schema is not provided, will search in all tables.",
        update: "If set to true, will update the existing semantic context, default is false.",
    },
    examples: `Example: Extract documentation from a web page
<code>waii database extract_doc --url "https://fleetdm.com/tables/chrome_extensions" --update true</code>

Example: Extract documentation from a text file
<code>waii database extract_doc --file "path/to/file.txt" --doc_type text --update false</code>

Example: Extract documentation from a local HTML file
<code>waii database extract_doc --file "path/to/file.html" --doc_type html --update true</code>

Options:
- \`--file\`: The URL of the web page or the path to the text file.
- \`--doc_type\`: The type of the documentation (only applies to \`file\`). It can be \`html\`, \`text\`. Default is \`text\`.
- \`--url\`: The URL of the web page. (Note that you can only use \`--file\` or \`--url\` at a time)
- \`--update\`: If set to \`true\`, the extracted documentation will be updated in the database. If set to \`false\`, the extracted documentation will be displayed in the console.
- \`--tables\`: The name of the tables where the documentation will be mapped to. By default we will search all the tables in the database.
- \`--schemas\`: The name of the schemas where the documentation will be mapped to. By default we will search all the schemas in the database.`
};

const extractDocFn = async (params: CmdParams) => {
    // check if url or file is provided, and only one of them
    if (!params.opts['url'] && !params.opts['file']) {
        throw new Error("url or file is required.");
    }
    if (params.opts['url'] && params.opts['file']) {
        throw new Error("only one of url or file is allowed.");
    }

    // read the content from file
    let content = params.opts['file'] ? require('fs').readFileSync(params.opts['file'], 'utf8') : undefined;

    // read the limited schemas and tables
    let schemas = []
    let tables = []
    if (params.opts['schemas']) {
        schemas = params.opts['schemas'].split(',');
        // trim it
        schemas = schemas.map((s: string) => s.trim())
    }
    if (params.opts['tables']) {
        tables = params.opts['tables'].split(',');
        // trim it
        tables = tables.map((t: string) => t.trim())
    }

    let doc_type: DocumentContentType = DocumentContentType.text;
    if (params.opts['doc_type']) {
        doc_type = params.opts['doc_type'] as DocumentContentType;
    }

    // create search context
    let search_context: SearchContext[] = []
    if (schemas.length > 0) {
        for (const s of schemas) {
            search_context.push({
                schema_name: s
            })
        }
    }
    if (tables.length > 0) {
        for (const t of tables) {
            search_context.push({
                table_name: t
            })
        }
    }

    let result = await WAII.Database.extractDatabaseDocumentation({
        url: params.opts['url'],
        content: content,
        search_context: search_context,
        content_type: doc_type
    });

    // convert to semantic context
    let doc = result.database_documentation;
    
    let semanticStatements: SemanticStatement[] = []

    for (const schema of doc.schemas || []) {
        let schema_name = schema.schema_name.schema_name;
        let schema_doc = schema.documentation;
        if (schema_name && schema_doc) {
            semanticStatements.push({
                scope: quoteSchemaNameIfNeeded(schema.schema_name),
                statement: schema_doc,
                always_include: true
            });
        }

        for (const table of schema.tables || []) {
            if (table.table_name) {
                let fullyQualifiedTableName = quoteTableNameIfNeeded(table.table_name);
                if (table.documentation) {
                    semanticStatements.push({
                        scope: fullyQualifiedTableName,
                        statement: table.documentation,
                        always_include: true
                    });

                    for (const column of table.columns || []) {
                        if (column.documentation) {
                            semanticStatements.push({
                                scope: fullyQualifiedTableName + "." + column.name,
                                statement: column.documentation,
                                always_include: true
                            });
                        }
                    }
                }
            }
        }
    }

    if (params.opts['update'] == "true") {
        let updateResult = await WAII.SemanticContext.modifySemanticContext({
            updated: semanticStatements
        });
        let n_updated = 0
        if (updateResult.updated) {
            n_updated = updateResult.updated.length || 0
        }
        console.log(`Updated ${n_updated} semantic statements.`);
    } else {
        // print the semantic context, enclose it in semantic_context so it can be used in import
        console.log(JSON.stringify({
            semantic_context: semanticStatements
        }, null, 2));
    }
}

const schemaListDoc = {
    description: "Show all available schemas.",
    parameters: [],
    stdin: "",
    options: {
        format: "choose the format of the response: text or json.",
    }
};
const schemaList = async (params: CmdParams) => {
    let result = await WAII.Database.getCatalogs();
    if (!result.catalogs || result.catalogs.length === 0) {
        throw new Error("No databases configured.");
    }
    if (!result.catalogs[0].schemas) {
        throw new Error("No schemas found");
    }
    switch (params.opts['format']) {
        case 'json': {
            console.log(JSON.stringify(result.catalogs[0].schemas, null, 2));
            break;
        }
        default: {
            const p = new Table({
                columns: [
                    { name: 'schema', title: 'schema', alignment: 'left' },
                    { name: 'tables', title: 'tables', alignment: 'left' },
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

const schemaDescribeDoc = {
    description: "Get a generated description of a schema.",
    parameters: ["schema_name - name of the schema to describe"],
    stdin: "",
    options: {
        format: "choose the format of the response: text or json"
    },
    examples: `Example: Describe a schema
<code>waii schema describe RETAIL_DATA</code>

<code>
Schema:
-------
TWEAKIT_PLAYGROUND.RETAIL_DATA

Description:
------------
The TWEAKIT_PLAYGROUND.RETAIL_DATA schema contains tables related to retail data analysis, including 
information about call centers, customers, addresses, demographics, dates, household demographics, 
income bands, inventory, items, promotions, reasons, stores, store returns, store sales, time 
dimensions, and warehouses.

Tables:
-------
┌────────────────────────┐
│ table                  │
├────────────────────────┤
│ PROMOTION              │
│ STORE_SALES            │
│ ITEM                   │
</code>`
};
const schemaDescribe = async (params: CmdParams) => {
    let result = await WAII.Database.getCatalogs();
    let schema = null;

    if (!result.catalogs || result.catalogs.length === 0) {
        throw new Error("No databases configured.");
    }

    if (!result.catalogs[0].schemas) {
        throw new Error("No schemas found.");
    }

    if (params.vals.length < 1) {
        throw new ArgumentError("No schema provided.")
    }

    // schema name to describe
    let target_schema_name = params.vals[0];

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
        throw new Error("Can't find schema: " + target_schema_name);
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
                        { name: 'table', title: 'table', alignment: 'left' },
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

const tableListDoc = {
    description: "List all tables in the current database.",
    parameters: [],
    stdin: "",
    options: {
        format: "choose the format of the response: text or json"
    },
    examples: `Example: List all tables in the current database
<code>waii table list</code>

<code>
Output:
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ INFORMATION_SCHEMA                                                                   │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ ENABLED_ROLES                    TABLES                           COLUMNS            │
│ SEQUENCES                        VIEWS                            TABLE_PRIVILEGES   │
│ DATABASES                        REPLICATION_DATABASES            REPLICATION_GROUPS │
└──────────────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ RETAIL_DATA                                                                          │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ PROMOTION               STORE_SALES             ITEM                    STORE        │
│ DATE_DIM               HOUSEHOLD_DEMOGRAPHICS   TIME_DIM                CUSTOMER     │
└──────────────────────────────────────────────────────────────────────────────────────┘
</code>`
};
const tableList = async (params: CmdParams) => {
    let result = await WAII.Database.getCatalogs();
    if (!result.catalogs || result.catalogs.length === 0) {
        throw new Error("No databases configured.");
    }

    if (!result.catalogs[0].schemas) {
        throw new Error("No tables found.");
    }

    let schemaSet = new Set<string>();
    let includeSchema = params.opts['include_schema'];

    if (includeSchema) {
        const schemaNames = includeSchema.split(',')
                                         .filter(Boolean)
                                         .map((name: string) => name.trim().toLowerCase());
        if (schemaNames.length === 0) {
            console.error("No schemas specified to include.");
            return;
        }
        schemaSet = new Set(schemaNames);
    }

    switch (params.opts['format']) {
        case 'json': {
            const tableList = [];
            for (const schema of result.catalogs[0].schemas) {
                if (!includeSchema || schemaSet.has(schema.name.schema_name.toLowerCase())) {
                    tableList.push(schema);
                }
            }

            if (tableList.length === 0 && includeSchema) {
                console.error("Schema not found");
            } else {
                console.log(JSON.stringify(tableList, null, 2));
            }
            break;
        }
        default: {
            for (const schema of result.catalogs[0].schemas) {

                if (!includeSchema || schemaSet.has(schema.name.schema_name.toLowerCase())) {
                    let tables = schema.tables ? schema.tables.map(table => table.name.table_name) : [];
                    let t_s = formatStrings(tables);
                    const p_s = new Table({
                        columns: [
                            { name: 'table', title: schema.name.schema_name, alignment: 'left' },
                        ],
                    });
                    for (const t of t_s.split('\n')) {
                        p_s.addRow({
                            table: t,
                        });
                    }
                    p_s.printTable();
                }
            }
            break;
        }
    }
};

function noQuoteNeeded(identifier: string, includeLowerCases: boolean = true): boolean {
    // If already quoted, no need to quote again
    if (identifier.startsWith('"') && identifier.endsWith('"')) {
        return true;
    }

    // Regex to check uppercase identifiers
    let matched = /^[A-Z_][A-Z_0-9$]*$/.test(identifier);
    if (matched) {
        return true;
    }

    // Check lowercase identifiers if includeLowerCases is true
    if (includeLowerCases) {
        matched = /^[a-z_][a-z_0-9$]*$/.test(identifier);
        if (matched) {
            return true;
        }
    }

    return false;
}

const quoteNameIfNeeded = (name?: string): string | null => {
    if (!name) {
        return null;
    }

    if (noQuoteNeeded(name, false)) {
        return name;
    } else {
        return '"' + name + '"';
    }
}

const quoteTableNameIfNeeded = (name: TableName): string => {
    let db_name = quoteNameIfNeeded(name.database_name);
    let schema_name = quoteNameIfNeeded(name.schema_name);
    let table_name = quoteNameIfNeeded(name.table_name);

    // connect not-null parts
    let result = "";
    if (db_name) {
        result += db_name + ".";
    }
    if (schema_name) {
        result += schema_name + ".";
    }
    return result + table_name;
}

const quoteSchemaNameIfNeeded = (name: SchemaName): string => {
    let db_name = quoteNameIfNeeded(name.database_name);
    let schema_name = quoteNameIfNeeded(name.schema_name);

    // connect not-null parts
    let result = "";
    if (db_name) {
        result += db_name + ".";
    }
    return result + schema_name;
}

const tableDDLDoc = {
    description: "Convert from table definition to ddl",
    parameters: [],
    stdin: ""

};
const tableDDL = async (params: CmdParams) => {
    let result = await WAII.Database.getCatalogs();
    if (!result.catalogs || result.catalogs.length === 0) {
        throw new Error("No databases configured.");
    }
    let ddl = ''

    if (!result.catalogs[0].schemas) {
        throw new Error("No tables found.");
    }

    console.log(result)
    for (const catalog of result.catalogs) {
        ddl += `CREATE DATABASE IF NOT EXISTS ${quoteNameIfNeeded(catalog.name)};\n`

        if (!catalog.schemas) {
            continue;
        }
        for (const schema of catalog.schemas) {
            // Don't process any information schema tables
            if (schema.name.schema_name.toLowerCase() === 'information_schema') {
                continue;
            }

            ddl += `CREATE SCHEMA IF NOT EXISTS ${quoteSchemaNameIfNeeded(schema.name)};\n`

            if (!schema.tables) {
                continue;
            }
            for (const table of schema.tables) {
                if (!table.columns) {
                    continue;
                }
                ddl += `CREATE TABLE IF NOT EXISTS ${quoteTableNameIfNeeded(table.name)} (\n`

                for (let i = 0; i < table.columns.length; i++) {
                    const column = table.columns[i];
                    ddl += `    ${quoteNameIfNeeded(column.name)} ${column.type}`
                    if (i < table.columns.length - 1) {
                        ddl += ",\n"
                    }
                }
                ddl += `);\n`
            }
        }
    }

    console.log(ddl)

    // TODO, add indexes, constraints, etc
}

const tableDescribeDoc = {
    description: "Show the details of a table.",
    parameters: ["<db>.<schema>.<table> - table name of the table to describe."],
    stdin: "",
    options: {
        format: "choose the format of the response: text or json.",
    }
};
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
        throw new Error("No databases configured.");
    }

    if (!result.catalogs[0].schemas) {
        throw new Error("No schemas found.");
    }
    let tables = [];
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
        throw new Error("Too many tables found. Please specify the schema_name too. Tables=["
            + tables.map((t) => t.name.schema_name + "." + t.name.table_name).join(", ") + "]");
    }

    if (tables.length == 0) {
        throw new Error("Can't find table: " + params.vals[0]);
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
                        { name: 'column', title: 'column', alignment: 'left' },
                        { name: 'type', title: 'type', alignment: 'left' },
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

const updateTableDescriptionDoc = {
    description: "Update the textual description of a table.",
    parameters: ["<db>.<schema>.<table> - name of the table to change", "description - description to use."],
    stdin: "",
    options: {
    }
};
const updateTableDescription = async (params: CmdParams) => {
    let table_name = params.vals[0]
    let description = params.vals[1]
    if (!table_name || !description) {
        throw new ArgumentError("table_name and description are required");
    }

    // use "." to split table_name into db_name, schema_name and table_name
    const arr = table_name.split(".");

    if (arr.length === 1) throw new Error("Invalid table name format.");
    
    const updateTableDescPayload = {
      description,
      table_name: arr.length === 2
        ? { schema_name: arr[0], table_name: arr[1] }
        : { database_name: arr[0], schema_name: arr[1], table_name: arr[2] }
    };
    
    await WAII.Database.updateTableDescription(updateTableDescPayload);
}

const schemaUpdateDescriptionDoc = {
    description: "Update the textual description of a schema.",
    parameters: ["<db>.<schema> - name of the schema to change", "description - description to use."],
    stdin: "",
    options: {
    }
};
const schemaUpdateDescription = async (params: CmdParams) => {
    let name = params.vals[0];
    let description = params.vals[1];
    let schema_name = null;
    let database_name = null;

    if (!schema_name || !description) {
        throw new ArgumentError("database name, schema_name and description are required");
    }

    // if target schema name includes ".", get schema name from it (last element)
    if (name.includes(".")) {
        let arr = name.split(".");
        if (arr.length != 2) {
            throw new Error("name given is not of the form <db name>.<schema name>");
        }
        schema_name = arr[1];
        database_name = arr[0];
    }

    if (!database_name || !schema_name) {
        throw new ArgumentError("Incorrect name, need <db name>.<schema name>");
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
        throw new ArgumentError("Invalid database name: " + name);
    }
    return name.split('.')[0];
}

const getSchemaName = (name: string): string => {
    if (!name) {
        throw new ArgumentError("Invalid schema name: " + name);
    }

    if (name.split('.').length < 2) {
        throw new Error("Invalid name: " + name);
    }
    return name.split('.')[1];
}

const getTableName = (name: string): string => {
    if (!name) {
        throw new ArgumentError("Invalid table name: " + name);
    }

    if (name.split('.').length < 3) {
        throw new Error("Invalid name: " + name + ", please use fully qualified name: <db>.<schema>.<table>");
    }
    return name.split('.')[2];
}

const findSchema = async (name: string): Promise<Schema> => {

    let result = await WAII.Database.getCatalogs();
    if (!result.catalogs || result.catalogs.length === 0) {
        throw new Error("No databases configured.");
    }
    if (!result.catalogs[0].schemas) {
        throw new Error("No schemas found");
    }

    let schema = null;
    for (const s of result.catalogs[0].schemas) {
        if (s.name.schema_name.toLowerCase() == name.toLowerCase()) {
            schema = s;
        }
    }
    if (!schema) {
        throw new Error("Can't find schema: " + name);
    }
    return schema;
}

const schemaUpdateQuestionDoc = {
    description: "Update the common questions stored for a schema.",
    parameters: ["<db>.<schema> - name of the schema to change", "questions - three individual questions to use."],
    stdin: "Qestions can be read (one per line) from the stdin.",
    options: {
    }
};
const schemaUpdateQuestions = async (params: CmdParams) => {
    let name = params.vals[0];
    let database_name = getDBName(name);
    let schema_name = getSchemaName(name);

    let questions = params.vals.slice(1);

    if (questions.length < 3) {
        questions = params.input.split("\n");
        if (questions.length < 3) {
            throw new ArgumentError("Need 3 questions.");
        }
    }
    questions = questions.slice(0, 3);

    let schema: Schema = await findSchema(schema_name);

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

const schemaUpdateSummaryDoc = {
    description: "Update the textual summary of a schema.",
    parameters: ["<db>.<schema> - name of the schema to change", "description - description to use."],
    stdin: "Summary can be read from stdin.",
    options: {
    }
};
const schemaUpdateSummary = async (params: CmdParams) => {
    let name = params.vals[0];
    let database_name = getDBName(name);
    let schema_name = getSchemaName(name);

    let summary = params.vals[1];

    if (!summary) {
        summary = params.input;
        if (!summary) {
            throw new ArgumentError("Need valid summary.");
        }
    }

    let schema: Schema = await findSchema(schema_name);

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

const schemaMigrationDoc = {
    description: "Create SQL statement that migrates all table of a schema from one database to another.",
    parameters: ["<db>.<schema> - name of the schema to migrate", "<db>.<schema> - destination schema."],
    stdin: "",
    options: {
        source: "key of the source database, see 'waii database list' for options",
        destination: "key of the destination database."
    }
};
const schemaMigration = async (params: CmdParams) => {
    let name = params.vals[0];
    let database_name = getDBName(name);
    let schema_name = getSchemaName(name);

    let dest_name = params.vals[1];

    let dest_database_name = '';
    let dest_schema_name = schema_name;

    if (dest_name) {
        dest_database_name = getDBName(dest_name);
        dest_schema_name = getSchemaName(dest_name);
    }

    let source = params.opts['source'];
    let dest = params.opts['destination'];

    if (!source || !dest) {
        throw new ArgumentError("Please provide valid source and destination.");
    }

    let dbResult = await WAII.Database.activateConnection(source);

    let result = await WAII.Database.getCatalogs();
    if (!result.catalogs || result.catalogs.length === 0) {
        throw new Error("No databases configured.");
    }

    if (!result.catalogs[0].schemas) {
        throw new Error("No tables found.");
    }

    let tables = []
    for (const schema of result.catalogs[0].schemas) {
        if (schema.name.schema_name === schema_name) {
            console.log();
            for (const table of (schema.tables ? schema.tables : [])) {
                params.vals[0] = `${database_name}.${schema_name}.${table.name.table_name}`;
                await tableMigration(params);
                console.log();
            }
            break;
        }
    }
}

const tableMigrationDoc = {
    description: "Create SQL statement that migrates a table from one database to another.",
    parameters: ["<db>.<schema>.<table> - name of the table to migrate", "<db>.<schema> - destination schema."],
    stdin: "",
    options: {
        source: "key of the source database, see 'waii database list' for options",
        destination: "key of the destination database."
    }
};
const tableMigration = async (params: CmdParams) => {
    let name = params.vals[0];
    let database_name = getDBName(name);
    let schema_name = getSchemaName(name);
    let table_name = getTableName(name);

    let dest_name = params.vals[1];

    let dest_database_name = '';
    let dest_schema_name = schema_name;

    if (dest_name) {
        dest_database_name = getDBName(dest_name);
        dest_schema_name = getSchemaName(dest_name);
    }

    let source = params.opts['source'];
    let dest = params.opts['destination'];

    if (!source || !dest) {
        throw new ArgumentError("Please provide valid source and destination.");
    }

    let msg = "Generate create table statement for the table \"" + name;
    let context = [{ database_name: database_name, schema_name: schema_name, table_name: table_name }];

    let dbResult = await WAII.Database.activateConnection(source);

    let sourceType = '';
    let destType = '';

    if (dbResult.connectors) {
        for (const c of dbResult.connectors) {
            if (c.key === source) {
                sourceType = c.db_type;
            }

            if (c.key === dest) {
                destType = c.db_type;
            }
        }
    }

    let result = await WAII.Query.generate({ search_context: context, ask: msg });

    if (!result.query) {
        throw new Error("Translation failed.");
    }

    msg =
        `Rewrite the following create statement coming from a ${sourceType} database to produce the same table in ${destType}.

Only use data types and contructs available in ${destType}. Make sure all the types are translated correctly for ${destType}.

Create the new table in the schema: ${schema_name}. Do not include a database name in the statement.

Statement: ${result.query}
`
    await WAII.Database.activateConnection(dest);

    params.vals[0] = msg
    await queryCommands.create.fn(params);
}

const databaseCommands = {
    list: { fn: databaseList, doc: databaseListDoc },
    add: { fn: databaseAdd, doc: databaseAddDoc },
    delete: { fn: databaseDelete, doc: databaseDeleteDoc },
    activate: { fn: databaseActivate, doc: databaseActivateDoc },
    describe: { fn: databaseDescribe, doc: databaseDescribeDoc },
    extract_doc: { fn: extractDocFn, doc: extractDoc }
};

const schemaCommands = {
    describe: { fn: schemaDescribe, doc: schemaDescribeDoc },
    list: { fn: schemaList, doc: schemaListDoc },
    update: { fn: schemaUpdateDescription, doc: schemaUpdateDescriptionDoc },
    update_questions: { fn: schemaUpdateQuestions, doc: schemaUpdateQuestionDoc },
    update_summary: { fn: schemaUpdateSummary, doc: schemaUpdateSummaryDoc },
    migrate: { fn: schemaMigration, doc: schemaMigrationDoc }
};

const tableCommands = {
    describe: { fn: tableDescribe, doc: tableDescribeDoc },
    list: { fn: tableList, doc: tableListDoc },
    update: { fn: updateTableDescription, doc: updateTableDescriptionDoc },
    migrate: { fn: tableMigration, doc: tableMigrationDoc },
    ddl: { fn: tableDDL, doc: tableDDLDoc }
};

export { databaseCommands, schemaCommands, tableCommands };
