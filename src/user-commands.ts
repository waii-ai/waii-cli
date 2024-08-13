import WAII from 'waii-sdk-js';
import { CmdParams } from './cmd-line-parser';

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

/**
 * User Commands
 *
 * This object contains all user-related commands.
 */
const userCommands = {
    create_access_key: { fn: createAccessKey, doc: createAccessKeyDoc }
};

export { userCommands };