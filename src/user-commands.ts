import WAII from 'waii-sdk-js';
import { CmdParams } from './cmd-line-parser';
import { Table } from 'console-table-printer';


/**
 * Create Access Key Command
 *
 * This function handles the creation of a new access key for a user.
 *
 * @param params Command parameters
 */
const createAccessKey = async (params: CmdParams) => {
    const keyName = params.vals[0];

    if (!keyName) {
        throw new Error("Access key name is required.");
    }

    // Assuming CreateAccessKeyRequest is an object that requires a `name` property.
    const createAccessKeyParams = {
        name: keyName,
    };

    try {
        const result = await WAII.User.createAccessKey(createAccessKeyParams);
        console.log("Access Key created successfully:");
        console.log(JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Error creating access key:");
        throw e;
        
        
    }
};

/**
 * List Access Keys Command
 *
 * This function lists all access keys for the user.
 *
 * @param params Command parameters
 */
const listAccessKeys = async (params: CmdParams) => {
    try {
        const result = await WAII.User.listAccessKeys({});

        if (!result || !result.access_keys || result.access_keys.length === 0) {
            console.log("No access keys found.");
            return;
        }

        const p = new Table({
            columns: [
                { name: 'Access Key', alignment: 'left' },
                { name: 'User ID', alignment: 'left' },
                { name: 'Name', alignment: 'left' },
                { name: 'Created At', alignment: 'left' }
            ]
        });

        result.access_keys.forEach((key) => {
            p.addRow({
                'Access Key': key.access_key,
                'User ID': key.user_id,
                'Name': key.name || 'N/A',
                'Created At': key.created_at ? new Date(key.created_at).toLocaleString() : 'N/A'
            });
        });

        p.printTable();
    } catch (error) {
        console.error("Error listing access keys:");
        throw error;
    }
};

/**
 * Delete Access Key Command
 *
 * This function deletes specified access keys for the user.
 *
 * @param params Command parameters
 */
const deleteAccessKey = async (params: CmdParams) => {
    const keyNames = params.vals;

    if (!keyNames || keyNames.length === 0) {
        throw new Error("You must specify at least one access key name to delete.");
    }

    const deleteAccessKeyParams = {
        names: keyNames,
    };

    try {
        const result = await WAII.User.deleteAccessKey(deleteAccessKeyParams);
        console.log("Access Keys deleted successfully:", keyNames.join(", "));
    } catch (error) {
        console.error("Error deleting access keys");
        throw error;
    }
};

/**
 * Get User Info Command
 *
 * This function retrieves information about the user.
 *
 * @param params Command parameters
 */
const getUserInfo = async (params: CmdParams) => {
    try {
        const result = await WAII.User.getInfo({});

        if (!result) {
            console.log("No user information found.");
            return;
        }

        const p = new Table({
            columns: [
                { name: 'Property', alignment: 'left' },
                { name: 'Value', alignment: 'left', maxLen: 60, minLen: 40 },
            ]
        });

        p.addRow({ Property: 'User ID', Value: result.id });
        p.addRow({ Property: 'Name', Value: result.name });
        p.addRow({ Property: 'Email', Value: result.email });
        p.addRow({ Property: 'Roles', Value: result.roles.join(', ') });
        p.addRow({ Property: 'Permissions', Value: result.permissions.join(', ') });

        p.printTable();
    } catch (error) {
        console.error("Error retrieving user information");
        throw error;
    }
};

/**
 * Update Config Command
 *
 * This function updates the user's configuration settings.
 *
 * @param params Command parameters
 */
const updateConfig = async (params: CmdParams) => {
    const updates:Record<string, any> = {};
    const deletions: string[] = [];

    // Parse options for updates and deletions
    for (const key in params.opts) {
        if (params.opts[key] === 'delete') {
            deletions.push(key);
        } else {
            updates[key] = params.opts[key];
        }
    }

    const updateConfigParams = {
        updated: Object.keys(updates).length > 0 ? updates : undefined,
        deleted: deletions.length > 0 ? deletions : undefined,
    };

    try {
        const result = await WAII.User.updateConfig(updateConfigParams);

        if (!result || !result.configs) {
            console.log("No configuration found.");
            return;
        }

        const p = new Table({
            columns: [
                { name: 'Key', alignment: 'left' },
                { name: 'Value', alignment: 'left', maxLen: 60, minLen: 40 },
            ]
        });

        for (const key in result.configs) {
            p.addRow({ Key: key, Value: result.configs[key] });
        }

        p.printTable();
    } catch (error) {
        console.error("Error updating configuration");
        throw error;
    }
};

/**
 * Create User Command
 *
 * This function creates a new user.
 *
 * @param params Command parameters
 */
const createUser = async (params: CmdParams) => {
    const userId = params.vals[0];
    if (!userId) {
        throw new Error("User ID is required.");
    }

    const user = {
        id: userId,
        name: params.opts.name || '',
        tenant_id: params.opts.tenant_id || '',
        org_id: params.opts.org_id || '',
        variables: params.opts.variables ? JSON.parse(params.opts.variables) : {},
        roles: params.opts.roles ? params.opts.roles.split(',') : [],
    };

    const createUserParams = { user };

    try {
        const result = await WAII.User.createUser(createUserParams);
        console.log("User created successfully.");
    } catch (error) {
        console.error("Error creating user");
        throw error;
    }
};

/**
 * Delete User Command
 *
 * This function deletes an existing user.
 *
 * @param params Command parameters
 */
const deleteUser = async (params: CmdParams) => {
    const userId = params.vals[0];
    if (!userId) {
        throw new Error("User ID is required.");
    }

    const deleteUserParams = {
        id: userId,
    };

    try {
        const result = await WAII.User.deleteUser(deleteUserParams);
        console.log("User deleted successfully.");
    } catch (error) {
        console.error("Error deleting user");
        throw error;
    }
};

/**
 * Update User Command
 *
 * This function updates information about an existing user.
 *
 * @param params Command parameters
 */
const updateUser = async (params: CmdParams) => {
    const userId = params.vals[0];
    if (!userId) {
        throw new Error("User ID is required.");
    }

    const user = {
        id: userId,
        name: params.opts.name || '',
        tenant_id: params.opts.tenant_id || '',
        org_id: params.opts.org_id || '',
        variables: params.opts.variables ? JSON.parse(params.opts.variables) : {},
        roles: params.opts.roles ? params.opts.roles.split(',') : [],
    };

    const updateUserParams = { user };

    try {
        const result = await WAII.User.updateUser(updateUserParams);
        console.log("User updated successfully.");
    } catch (error) {
        console.error("Error updating user");
        throw error;
    }
};

/**
 * List Users Command
 *
 * This function retrieves a list of users.
 *
 * @param params Command parameters
 */
const listUsers = async (params: CmdParams) => {
    const lookupOrgId = params.opts.lookup_org_id || '';

    const listUsersParams = {
        lookup_org_id: lookupOrgId,
    };

    try {
        const result = await WAII.User.listUsers(listUsersParams);

        if (!result || !result.users || result.users.length === 0) {
            console.log("No users found.");
            return;
        }

        const p = new Table({
            columns: [
                { name: 'User ID', alignment: 'left' },
                { name: 'Name', alignment: 'left' },
                { name: 'Tenant ID', alignment: 'left' },
                { name: 'Org ID', alignment: 'left' },
                { name: 'Roles', alignment: 'left', maxLen: 60, minLen: 20 },
            ]
        });

        result.users.forEach((user) => {
            p.addRow({
                'User ID': user.id,
                'Name': user.name || 'N/A',
                'Tenant ID': user.tenant_id || 'N/A',
                'Org ID': user.org_id || 'N/A',
                'Roles': user.roles ? user.roles.join(', ') : 'N/A',
            });
        });

        p.printTable();
    } catch (error) {
        console.error("Error listing users");
        throw error;
    }
};



/**
 * Command documentation
 */
const createAccessKeyDoc = {
    description: "Create a new access key for a user.",
    parameters: [
        {
            name: "name",
            type: "string",
            description: "The name of the access key to create.",
        }
    ],
    stdin: "",
    options: {}
};

const listAccessKeysDoc = {
    description: "List all access keys for the user.",
    parameters: [],
    stdin: "",
    options: {}
};

const deleteAccessKeyDoc = {
    description: "Delete specified access keys for the user.",
    parameters: [
        {
            name: "names",
            type: "string[]",
            description: "An array of strings denoting the names of the access keys to be deleted.",
        }
    ],
    stdin: "",
    options: {}
};

const getUserInfoDoc = {
    description: "Retrieve information about the user.",
    parameters: [],
    stdin: "",
    options: {}
};

const updateConfigDoc = {
    description: "Update the user's configuration settings.",
    parameters: [],
    stdin: "",
    options: {
        "key=value": "Specify key-value pairs to update in the configuration.",
        "key=delete": "Specify keys to delete from the configuration."
    }
};

const createUserDoc = {
    description: "Create a new user.",
    parameters: [
        {
            name: "userId",
            type: "string",
            description: "The unique ID of the user to be created.",
        }
    ],
    stdin: "",
    options: {
        "name": "The display name of the user.",
        "tenant_id": "The tenant ID of the user.",
        "org_id": "The organization ID of the user.",
        "variables": "A JSON string representing the user's variables.",
        "roles": "A comma-separated list of roles assigned to the user.",
    }
};

const deleteUserDoc = {
    description: "Delete an existing user.",
    parameters: [
        {
            name: "userId",
            type: "string",
            description: "The user ID of the user to be deleted.",
        }
    ],
    stdin: "",
    options: {}
};

const updateUserDoc = {
    description: "Update information about an existing user.",
    parameters: [
        {
            name: "userId",
            type: "string",
            description: "The unique ID of the user to be updated.",
        }
    ],
    stdin: "",
    options: {
        "name": "The display name of the user.",
        "tenant_id": "The tenant ID of the user.",
        "org_id": "The organization ID of the user.",
        "variables": "A JSON string representing the user's variables.",
        "roles": "A comma-separated list of roles assigned to the user.",
    }
};

const listUsersDoc = {
    description: "Retrieve a list of users.",
    parameters: [],
    stdin: "",
    options: {
        "lookup_org_id": "The organization ID for which the users are to be retrieved."
    }
};


/**
 * User Commands
 *
 * This object contains all user-related commands.
 */
const userCommands = {
    create_access_key: { fn: createAccessKey, doc: createAccessKeyDoc },
    list_access_keys: { fn: listAccessKeys, doc: listAccessKeysDoc },
    delete_access_key: { fn: deleteAccessKey, doc: deleteAccessKeyDoc },
    info: { fn: getUserInfo, doc: getUserInfoDoc },
    update_config: { fn: updateConfig, doc: updateConfigDoc },
    create: { fn: createUser, doc: createUserDoc },
    delete: { fn: deleteUser, doc: deleteUserDoc },
    update: { fn: updateUser, doc: updateUserDoc }, 
    list: {fn: listUsers, doc: listUsersDoc}
};

export { userCommands };