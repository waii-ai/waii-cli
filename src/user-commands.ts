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
import { CmdParams } from './cmd-line-parser';
import { Table } from 'console-table-printer';

export type UserModel = {
    id: string;
    name?: string;
    tenant_id?: string;
    org_id?: string;
    variables?: Record<string, unknown>;
    roles?: string[];
};

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
        throw new Error('Access key name is required.');
    }

    // Assuming CreateAccessKeyRequest is an object that requires a `name` property.
    const createAccessKeyParams = {
        name: keyName
    };

    try {
        const result = await WAII.User.createAccessKey(createAccessKeyParams);
        console.log('Access Key created successfully:');
        console.log(JSON.stringify(result, null, 2));
    } catch (e) {
        console.error('Error creating access key:');
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const listAccessKeys = async (_params: CmdParams) => {
    try {
        const result = await WAII.User.listAccessKeys({});

        if (!result || !result.access_keys || result.access_keys.length === 0) {
            console.log('No access keys found.');
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
        console.error('Error listing access keys:');
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
        throw new Error('You must specify at least one access key name to delete.');
    }

    const deleteAccessKeyParams = {
        names: keyNames
    };

    try {
        /* const result = */ await WAII.User.deleteAccessKey(deleteAccessKeyParams);
        console.log('Access Keys deleted successfully:', keyNames.join(', '));
    } catch (error) {
        console.error('Error deleting access keys');
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getUserInfo = async (_params: CmdParams) => {
    try {
        const result = await WAII.User.getInfo({});

        if (!result) {
            console.log('No user information found.');
            return;
        }

        const p = new Table({
            columns: [
                { name: 'Property', alignment: 'left' },
                { name: 'Value', alignment: 'left', maxLen: 60, minLen: 40 }
            ]
        });

        p.addRow({ Property: 'User ID', Value: result.id });
        p.addRow({ Property: 'Name', Value: result.name });
        p.addRow({ Property: 'Email', Value: result.email });
        p.addRow({ Property: 'Roles', Value: result.roles.join(', ') });
        p.addRow({ Property: 'Permissions', Value: result.permissions.join(', ') });

        p.printTable();
    } catch (error) {
        console.error('Error retrieving user information');
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
    const updates:Record<string, unknown> = {};
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
        deleted: deletions.length > 0 ? deletions : undefined
    };

    try {
        const result = await WAII.User.updateConfig(updateConfigParams);

        if (!result || !result.configs) {
            console.log('No configuration found.');
            return;
        }

        const p = new Table({
            columns: [
                { name: 'Key', alignment: 'left' },
                { name: 'Value', alignment: 'left', maxLen: 60, minLen: 40 }
            ]
        });

        for (const key in result.configs) {
            p.addRow({ Key: key, Value: result.configs[key] });
        }

        p.printTable();
    } catch (error) {
        console.error('Error updating configuration');
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
        throw new Error('User ID is required.');
    }

    const user = {
        id: userId,
        name: params.opts.name || '',
        tenant_id: params.opts.tenant_id || '',
        org_id: params.opts.org_id || '',
        variables: params.opts.variables ? JSON.parse(params.opts.variables) : {},
        roles: params.opts.roles ? params.opts.roles.split(',') : []
    };

    const createUserParams = { user };

    try {
        /* const result = */ await WAII.User.createUser(createUserParams);
        console.log('User created successfully.');
    } catch (error) {
        console.error('Error creating user');
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
        throw new Error('User ID is required.');
    }

    const deleteUserParams = {
        id: userId
    };

    try {
        /* const result = */ await WAII.User.deleteUser(deleteUserParams);
        console.log('User deleted successfully.');
    } catch (error) {
        console.error('Error deleting user');
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
        throw new Error('User ID is required.');
    }

    const user = {
        id: userId,
        name: params.opts.name || '',
        tenant_id: params.opts.tenant_id || '',
        org_id: params.opts.org_id || '',
        variables: params.opts.variables ? JSON.parse(params.opts.variables) : {},
        roles: params.opts.roles ? params.opts.roles.split(',') : []
    };

    const updateUserParams = { user };

    try {
        /* const result = */ await WAII.User.updateUser(updateUserParams);
        console.log('User updated successfully.');
    } catch (error) {
        console.error('Error updating user');
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
        lookup_org_id: lookupOrgId
    };

    try {
        const result = await WAII.User.listUsers(listUsersParams);

        if (!result || !result.users || result.users.length === 0) {
            console.log('No users found.');
            return;
        }

        const p = new Table({
            columns: [
                { name: 'User ID', alignment: 'left' },
                { name: 'Name', alignment: 'left' },
                { name: 'Tenant ID', alignment: 'left' },
                { name: 'Org ID', alignment: 'left' },
                { name: 'Roles', alignment: 'left', maxLen: 60, minLen: 20 }
            ]
        });

        result.users.forEach((user) => {
            p.addRow({
                'User ID': user.id,
                'Name': user.name || 'N/A',
                'Tenant ID': user.tenant_id || 'N/A',
                'Org ID': user.org_id || 'N/A',
                'Roles': user.roles ? user.roles.join(', ') : 'N/A'
            });
        });

        p.printTable();
    } catch (error) {
        console.error('Error listing users');
        throw error;
    }
};

/**
 * Create Tenant Command
 *
 * This function creates a new tenant.
 *
 * @param params Command parameters
 */
const createTenant = async (params: CmdParams) => {
    const tenantId = params.vals[0];
    if (!tenantId) {
        throw new Error('Tenant ID is required.');
    }

    const tenant = {
        id: tenantId,
        name: params.opts.name || '',
        org_id: params.opts.org_id || undefined,
        variables: params.opts.variables ? JSON.parse(params.opts.variables) : undefined
    };

    const createTenantParams = { tenant };

    try {
        /* const result = */ await WAII.User.createTenant(createTenantParams);
        console.log('Tenant created successfully.');
    } catch (error) {
        console.error('Error creating tenant:');
        throw error;
    }
};

/**
 * Update Tenant Command
 *
 * This function updates information about an existing tenant.
 *
 * @param params Command parameters
 */
const updateTenant = async (params: CmdParams) => {
    const tenantId = params.vals[0];
    if (!tenantId) {
        throw new Error('Tenant ID is required.');
    }

    const tenant = {
        id: tenantId,
        name: params.opts.name || '',
        org_id: params.opts.org_id || undefined,
        variables: params.opts.variables ? JSON.parse(params.opts.variables) : undefined
    };

    const updateTenantParams = { tenant };

    try {
        /* const result = */ await WAII.User.updateTenant(updateTenantParams);
        console.log('Tenant updated successfully.');
    } catch (error) {
        console.error('Error updating tenant:');
        throw error;
    }
};

/**
 * Delete Tenant Command
 *
 * This function deletes an existing tenant.
 *
 * @param params Command parameters
 */
const deleteTenant = async (params: CmdParams) => {
    const tenantId = params.vals[0];
    if (!tenantId) {
        throw new Error('Tenant ID is required.');
    }

    const deleteTenantParams = { id: tenantId };

    try {
        /* const result = */ await WAII.User.deleteTenant(deleteTenantParams);
        console.log('Tenant deleted successfully.');
    } catch (error) {
        console.error('Error deleting tenant');
        throw error;
    }
};

/**
 * List Tenants Command
 *
 * This function retrieves a list of tenants.
 *
 * @param params Command parameters
 */
const listTenants = async (params: CmdParams) => {
    const listTenantsParams = {
        lookup_org_id: params.opts.lookup_org_id || undefined
    };

    try {
        const result = await WAII.User.listTenants(listTenantsParams);
        if (!result || !result.tenants || result.tenants.length === 0) {
            console.log('No tenants found.');
            return;
        }

        const p = new Table({
            columns: [
                { name: 'Tenant ID', alignment: 'left' },
                { name: 'Name', alignment: 'left' },
                { name: 'Org ID', alignment: 'left' },
                { name: 'Variables', alignment: 'left', maxLen: 60, minLen: 20 }
            ]
        });

        result.tenants.forEach((tenant) => {
            p.addRow({
                'Tenant ID': tenant.id,
                'Name': tenant.name || 'N/A',
                'Org ID': tenant.org_id || 'N/A',
                'Variables': tenant.variables ? JSON.stringify(tenant.variables) : 'N/A'
            });
        });

        p.printTable();
    } catch (error) {
        console.error('Error listing tenants:');
        throw error;
    }
};

/**
 * Create Organization Command
 *
 * This function creates a new organization.
 *
 * @param params Command parameters
 */
const createOrganization = async (params: CmdParams) => {
    const organizationId = params.vals[0];
    if (!organizationId) {
        throw new Error('Organization ID is required.');
    }

    const organization = {
        id: organizationId,
        name: params.opts.name || '',
        variables: params.opts.variables ? JSON.parse(params.opts.variables) : undefined
    };

    const createOrganizationParams = { organization };

    try {
        /* const result = */ await WAII.User.createOrganization(createOrganizationParams);
        console.log('Organization created successfully.');
    } catch (error) {
        console.error('Error creating organization:');
        throw error;
    }
};

/**
 * Update Organization Command
 *
 * This function updates an existing organization.
 *
 * @param params Command parameters
 */
const updateOrganization = async (params: CmdParams) => {
    const organizationId = params.vals[0];
    if (!organizationId) {
        throw new Error('Organization ID is required.');
    }

    const organization = {
        id: organizationId,
        name: params.opts.name || '',
        variables: params.opts.variables ? JSON.parse(params.opts.variables) : undefined
    };

    const updateOrganizationParams = { organization };

    try {
        /* const result = */ await WAII.User.updateOrganization(updateOrganizationParams);
        console.log('Organization updated successfully.');
    } catch (error) {
        console.error('Error updating organization:');
        throw error;
    }
};

/**
 * Delete Organization Command
 *
 * This function deletes an existing organization.
 *
 * @param params Command parameters
 */
const deleteOrganization = async (params: CmdParams) => {
    const organizationId = params.vals[0];
    if (!organizationId) {
        throw new Error('Organization ID is required.');
    }

    const deleteOrganizationParams = { id: organizationId };

    try {
        /* const result = */ await WAII.User.deleteOrganization(deleteOrganizationParams);
        console.log('Organization deleted successfully.');
    } catch (error) {
        console.error('Error deleting organization:');
        throw error;
    }
};

/**
 * List Organizations Command
 *
 * This function retrieves a list of organizations.
 *
 * @param params Command parameters
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const listOrganizations = async (_params: CmdParams) => {
    try {
        const result = await WAII.User.listOrganizations({});
        if (!result || !result.organizations || result.organizations.length === 0) {
            console.log('No organizations found.');
            return;
        }

        const p = new Table({
            columns: [
                { name: 'Organization ID', alignment: 'left' },
                { name: 'Name', alignment: 'left' },
                { name: 'Variables', alignment: 'left', maxLen: 60, minLen: 20 }
            ]
        });

        result.organizations.forEach((organization) => {
            p.addRow({
                'Organization ID': organization.id,
                'Name': organization.name || 'N/A',
                'Variables': organization.variables ? JSON.stringify(organization.variables) : 'N/A'
            });
        });

        p.printTable();
    } catch (error) {
        console.error('Error listing organizations:');
        throw error;
    }
};





/**
 * Command documentation
 */
const createAccessKeyDoc = {
    description: 'Create a new access key for a user.',
    parameters: [
        {
            name: 'name',
            type: 'string',
            description: 'The name of the access key to create.'
        }
    ],
    stdin: '',
    options: {}
};

const listAccessKeysDoc = {
    description: 'List all access keys for the user.',
    parameters: [],
    stdin: '',
    options: {}
};

const deleteAccessKeyDoc = {
    description: 'Delete specified access keys for the user.',
    parameters: [
        {
            name: 'names',
            type: 'string[]',
            description: 'An array of strings denoting the names of the access keys to be deleted.'
        }
    ],
    stdin: '',
    options: {}
};

const getUserInfoDoc = {
    description: 'Retrieve information about the user.',
    parameters: [],
    stdin: '',
    options: {}
};

const updateConfigDoc = {
    description: 'Update the user\'s configuration settings.',
    parameters: [],
    stdin: '',
    options: {
        'key=value': 'Specify key-value pairs to update in the configuration.',
        'key=delete': 'Specify keys to delete from the configuration.'
    }
};

const createUserDoc = {
    description: 'Create a new user.',
    parameters: [
        {
            name: 'userId',
            type: 'string',
            description: 'The unique ID of the user to be created.'
        }
    ],
    stdin: '',
    options: {
        'name': 'The display name of the user.',
        'tenant_id': 'The tenant ID of the user.',
        'org_id': 'The organization ID of the user.',
        'variables': 'A JSON string representing the user\'s variables.',
        'roles': 'A comma-separated list of roles assigned to the user.'
    }
};

const deleteUserDoc = {
    description: 'Delete an existing user.',
    parameters: [
        {
            name: 'userId',
            type: 'string',
            description: 'The user ID of the user to be deleted.'
        }
    ],
    stdin: '',
    options: {}
};

const updateUserDoc = {
    description: 'Update information about an existing user.',
    parameters: [
        {
            name: 'userId',
            type: 'string',
            description: 'The unique ID of the user to be updated.'
        }
    ],
    stdin: '',
    options: {
        'name': 'The display name of the user.',
        'tenant_id': 'The tenant ID of the user.',
        'org_id': 'The organization ID of the user.',
        'variables': 'A JSON string representing the user\'s variables.',
        'roles': 'A comma-separated list of roles assigned to the user.'
    }
};

const listUsersDoc = {
    description: 'Retrieve a list of users.',
    parameters: [],
    stdin: '',
    options: {
        'lookup_org_id': 'The organization ID for which the users are to be retrieved.'
    }
};
const createTenantDoc = {
    description: 'Create a new tenant.',
    parameters: [
        {
            name: 'tenantId',
            type: 'string',
            description: 'The unique ID of the tenant to be created.'
        }
    ],
    stdin: '',
    options: {
        name: 'The display name of the tenant.',
        org_id: 'The organization ID of the tenant.',
        variables: 'A JSON string representing the tenant\'s variables.'
    }
};

const updateTenantDoc = {
    description: 'Update an existing tenant.',
    parameters: [
        {
            name: 'tenantId',
            type: 'string',
            description: 'The unique ID of the tenant to be updated.'
        }
    ],
    stdin: '',
    options: {
        name: 'The display name of the tenant.',
        org_id: 'The organization ID of the tenant.',
        variables: 'A JSON string representing the tenant\'s variables.'
    }
};

const deleteTenantDoc = {
    description: 'Delete an existing tenant.',
    parameters: [
        {
            name: 'tenantId',
            type: 'string',
            description: 'The ID of the tenant to be deleted.'
        }
    ],
    stdin: '',
    options: {}
};

const listTenantsDoc = {
    description: 'Retrieve a list of tenants.',
    parameters: [],
    stdin: '',
    options: {
        lookup_org_id: 'The organization ID for which the tenants are to be retrieved.'
    }
};

const createOrganizationDoc = {
    description: 'Create a new organization.',
    parameters: [
        {
            name: 'organizationId',
            type: 'string',
            description: 'The unique ID of the organization to be created.'
        }
    ],
    options: {
        name: {
            type: 'string',
            description: 'The display name of the organization.'
        },
        variables: {
            type: 'string',
            description: 'A JSON string representing key-value pairs of organization variables.'
        }
    },
    stdin: ''
};

const updateOrganizationDoc = {
    description: 'Update an existing organization.',
    parameters: [
        {
            name: 'organizationId',
            type: 'string',
            description: 'The unique ID of the organization to be updated.'
        }
    ],
    options: {
        name: {
            type: 'string',
            description: 'The display name of the organization.'
        },
        variables: {
            type: 'string',
            description: 'A JSON string representing key-value pairs of organization variables.'
        }
    },
    stdin: ''
};

const deleteOrganizationDoc = {
    description: 'Delete an existing organization.',
    parameters: [
        {
            name: 'organizationId',
            type: 'string',
            description: 'The unique ID of the organization to be deleted.'
        }
    ],
    stdin: ''
};

const listOrganizationsDoc = {
    description: 'List all organizations.',
    parameters: [],
    stdin: ''
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
    list: {fn: listUsers, doc: listUsersDoc},
    create_tenant: { fn: createTenant, doc: createTenantDoc },
    update_tenant: { fn: updateTenant, doc: updateTenantDoc },
    delete_tenant: { fn: deleteTenant, doc: deleteTenantDoc },
    list_tenant: { fn: listTenants, doc: listTenantsDoc },
    create_org: { fn: createOrganization, doc: createOrganizationDoc },
    update_org:{ fn: updateOrganization, doc: updateOrganizationDoc },
    delete_org: {fn: deleteOrganization, doc: deleteOrganizationDoc},
    list_org: {fn: listOrganizations, doc: listOrganizationsDoc}

};

export { userCommands };
