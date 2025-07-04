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
import { SearchContext } from 'waii-sdk-js/dist/clients/database/src/Database';
import {
    ExportSemanticLayerDumpRequest,
    ImportSemanticLayerDumpRequest
} from 'waii-sdk-js/dist/clients/semant-layer-dump/src/SemanticLayerDump';
import * as YAML from 'yaml';
import * as fs from 'fs';
import * as path from 'path';

// Operation status constants
const OperationStatus = {
    SUCCEEDED: 'succeeded',
    FAILED: 'failed',
    IN_PROGRESS: 'in_progress',
    NOT_EXISTS: 'not_exists'
};

// Sleep helper function
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper for converting between YAML and JSON
function formatOutput(data: unknown, format: string): string {
    if (format === 'json') {
        return JSON.stringify(data, null, 2);
    } else {
        return YAML.stringify(data);
    }
}

function parseInput(content: string, format: string): unknown {
    if (format === 'json') {
        return JSON.parse(content);
    } else {
        return YAML.parse(content);
    }
}

function stringToBoolean(str: string): boolean {
    return /^(true|1|yes|y)$/i.test(str.trim());
}

const semanticLayerExportDoc = {
    description: 'Export semantic layer configuration for a database connection.',
    parameters: [],
    stdin: '',
    options: {
        db_conn_key: 'Required. Database connection key',
        file: 'Path to the output file. If not specified, prints to stdout.',
        format: 'Output format: yaml (default) or json.',
        search_context: 'Optional JSON string with search context parameters',
        poll_interval: 'Interval in ms to poll for export status (default: 1000)',
        timeout: 'Timeout in ms for export operation (default: 300 seconds)',
        max_retries: 'Maximum number of retries when operation status returns \'not_exists\' (default: 3). This can happen when the server has already processed and cleared the operation.',
        verbose: 'Show verbose debug information and display neatly formatted statistics'
    }
};

// Helper function to format export results
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatExportResults(data: any, verbose = false): string {
    if (!data) {
        return 'No export data available';
    }

    const output = [];
    output.push('\nExport statistics:');

    // Count objects by type
    const stats: Record<string, number> = {};

    // Handle different types of export data structures
    if (Array.isArray(data)) {
        // If it's an array of objects
        output.push(`  Total exported objects: ${data.length}`);

        // Count by type if objects have a 'type' field
        data.forEach(item => {
            if (item.type) {
                stats[item.type] = (stats[item.type] || 0) + 1;
            } else if (item.object_type) {
                stats[item.object_type] = (stats[item.object_type] || 0) + 1;
            }
        });
    } else if (typeof data === 'object') {
        // If it's a structured object with categories
        const categories = Object.keys(data);
        output.push(`  Total exported categories: ${categories.length}`);

        // Count objects in each category
        categories.forEach(category => {
            if (Array.isArray(data[category])) {
                stats[category] = data[category].length;
            } else if (typeof data[category] === 'object') {
                stats[category] = Object.keys(data[category]).length;
            }
        });
    }

    // Add stats by type/category
    if (Object.keys(stats).length > 0) {
        output.push('\n  By type:');
        Object.keys(stats).sort().forEach(type => {
            // Format type name for display (convert snake_case to Title Case)
            const displayName = type
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            output.push(`    ${displayName}: ${stats[type]}`);
        });
    }

    // If verbose is true, add more details about the exported objects
    if (verbose) {
        output.push('\n  Exported objects:');

        if (Array.isArray(data)) {
            data.forEach(item => {
                if (item.name) {
                    const typeInfo = item.type || item.object_type || 'Object';
                    output.push(`    - ${typeInfo}: ${item.name}`);
                } else if (item.id) {
                    output.push(`    - Object with ID: ${item.id}`);
                }
            });
        } else if (typeof data === 'object') {
            Object.keys(data).forEach(category => {
                if (Array.isArray(data[category]) && data[category].length > 0) {
                    // Format category name for display
                    const displayCategory = category
                        .split('_')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');

                    output.push(`\n    ${displayCategory}:`);

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    data[category].forEach((item: any) => {
                        if (typeof item === 'object') {
                            if (item.name) {
                                output.push(`      - ${item.name}`);
                            } else if (item.id) {
                                output.push(`      - ID: ${item.id}`);
                            } else {
                                const keys = Object.keys(item).filter(k => typeof item[k] !== 'object');
                                if (keys.length > 0) {
                                    output.push(`      - ${keys[0]}: ${item[keys[0]]}`);
                                }
                            }
                        } else {
                            output.push(`      - ${item}`);
                        }
                    });
                }
            });
        }
    }

    return output.join('\n');
}

const semanticLayerExport = async (params: CmdParams) => {
    // Required parameters
    if (!('db_conn_key' in params.opts)) {
        console.error('Error: Required option \'db_conn_key\' is missing.');
        return;
    }

    const dbConnKey = params.opts['db_conn_key'];
    const searchContext: SearchContext[] = params.opts['search_context'] ?
        JSON.parse(params.opts['search_context']) : [{
            db_name: '*',
            schema_name: '*',
            table_name: '*'
        }];
    const format = params.opts['format'] || 'yaml';
    const pollInterval = params.opts['poll_interval'] ?
        parseInt(params.opts['poll_interval']) : 1000;
    const timeout = params.opts['timeout'] ?
        parseInt(params.opts['timeout']) : 5 * 60 * 1000; // 5 minutes default timeout
    const verbose = 'verbose' in params.opts;
    const maxRetries = params.opts['max_retries'] ?
        parseInt(params.opts['max_retries']) : 3; // Default to 3 retries

    // Start export operation
    console.log(`Starting semantic layer export for database connection '${dbConnKey}'...`);

    try {
        const exportRequest: ExportSemanticLayerDumpRequest = {
            db_conn_key: dbConnKey,
            search_context: searchContext
        };

        if (verbose) {
            console.log(`Export request: ${JSON.stringify(exportRequest)}`);
        }

        const exportResp = await WAII.SemanticLayerDump.export(exportRequest);
        const opId = exportResp.op_id;
        console.log(`Export operation started with ID: ${opId}`);

        // Poll for status
        let status = OperationStatus.IN_PROGRESS;
        let result = null;
        let dots = 0;
        const startTime = Date.now();
        let notExistsRetries = 0;

        process.stdout.write('Waiting for export to complete');

        while (status === OperationStatus.IN_PROGRESS || (status === OperationStatus.NOT_EXISTS && notExistsRetries < maxRetries)) {
            // Check for timeout
            if (Date.now() - startTime > timeout) {
                process.stdout.write('\n');
                console.error(`Export operation timed out after ${timeout/1000} seconds.`);
                return;
            }

            await sleep(pollInterval);

            try {
                const statusResp = await WAII.SemanticLayerDump.checkExportStatus({
                    op_id: opId
                });

                if (verbose) {
                    process.stdout.write('\n');
                    console.log(`Status response: ${JSON.stringify(statusResp)}`);
                }

                status = statusResp.status;

                if (status === OperationStatus.SUCCEEDED) {
                    process.stdout.write('\n');
                    console.log('Export completed successfully!');
                    result = statusResp.info;
                    if (verbose) {
                        console.log(`Result received: ${result ? 'yes' : 'no'}`);
                    }

                    // Break out of the loop since we've succeeded
                    // We must save the result to 'result' variable before breaking
                    // because the server removes the operation from storage once queried (for now)
                    break;
                } else if (status === OperationStatus.FAILED) {
                    process.stdout.write('\n');
                    console.error(`Export failed: ${statusResp.info}`);
                    return;
                } else if (status === OperationStatus.NOT_EXISTS) {

                    // Handle the "not_exists" status
                    // This can happen if:
                    // 1. The operation ID is invalid
                    // 2. The operation was completed and already queried once (server removes completed operations after querying)
                    // 3. The operation was cleaned up by the server
                    notExistsRetries++;

                    if (notExistsRetries >= maxRetries) {
                        process.stdout.write('\n');
                        console.error(`Export operation not found on server after ${maxRetries} retries. Operation ID: ${opId}`);
                        console.error('This could mean the operation was never started or was already completed and cleaned up.');
                        console.error('If this is a persistent issue, please check if the database connection is valid.');
                        return;
                    }

                    // Continue polling for now, because later we might persist it in the database, but with warning in verbose mode
                    if (verbose) {
                        console.log(`Operation not found on server (retry ${notExistsRetries}/${maxRetries})...`);
                    }

                    // continue the loop
                    status = OperationStatus.IN_PROGRESS;
                } else {
                    // progress indicator
                    dots = (dots + 1) % 4;
                    const progressDots = '.'.repeat(dots);
                    process.stdout.write(`\rWaiting for export to complete${progressDots}${' '.repeat(4 - dots)}`);
                }
            } catch (pollError) {
                console.error(`\nError while checking export status: ${pollError}`);
                // Continue polling despite error till max retries/timeout
            }
        }

        if (verbose) {
            console.log(`After polling loop. Result: ${result ? 'has data' : 'is null/undefined'}`);
        }

        // Save to file if specified
        if ('file' in params.opts && result) {
            const filePath = params.opts['file'];
            const dirPath = path.dirname(filePath);

            // Ensure directory exists
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }

            // Format to yaml/json and write to file
            const outputData = formatOutput(result, format);
            fs.writeFileSync(filePath, outputData);
            console.log(`Semantic layer configuration exported to ${filePath} (${format} format)`);

            // If verbose, also display formatted statistics
            if (verbose) {
                console.log(formatExportResults(result, verbose));
            }
        } else if (result) {
            // Print to stdout
            const outputData = formatOutput(result, format);
            console.log(outputData);

            // If verbose, also display formatted statistics
            if (verbose) {
                console.log(formatExportResults(result, verbose));
            }
        } else {
            console.error('Export completed but no data was returned.');
            console.error('This may indicate that the database has no exportable semantic layer configuration.');
            console.error('If you believe this is an error, try running with the --verbose flag for more details.');
            // Add more specific user guidance
            console.error('Consider checking if:');
            console.error(' - The database connection is valid and contains semantic layer configuration');
            console.error(' - Your permissions allow access to the semantic layer configuration');
            console.error(' - The search_context parameter is correctly specified (if used)');
        }
    } catch (error) {
        console.error(`Error during export: ${error}`);
    }
};

// Helper function to format import results
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatImportResults(info: any, verbose = false, isDryRun = false): string {
    // Remove debug info
    if (!info || !info.stats) {
        return 'No detailed information available';
    }

    const stats = info.stats;
    const output = [];

    // Add message if available
    if (info.message) {
        output.push(info.message);
    }

    // For dry runs, add a clear heading
    if (isDryRun) {
        output.push('\n== DRY RUN SIMULATION - NO CHANGES WERE MADE ==');
    }

    output.push('\nImport statistics:');

    // Process each category of imported/ignored items
    for (const category in stats) {
        const categoryData = stats[category];
        const imported = categoryData.imported?.length || 0;
        const ignored = categoryData.ignored?.length || 0;

        // Format category name for display (convert snake_case to Title Case)
        const displayName = category
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

        output.push(`  ${displayName}:`);
        output.push(`    Imported: ${imported}`);
        output.push(`    Ignored: ${ignored}`);

        // Always show objects, but limit the number in normal mode
        if (imported > 0 && Array.isArray(categoryData.imported)) {
            output.push('\n    Imported objects:');

            // Default limit for objects to show in normal mode
            const DEFAULT_OBJECTS_LIMIT = 20;
            const objectsLimit = verbose ? 1000 : DEFAULT_OBJECTS_LIMIT; // Only increase limit in verbose mode

            if (categoryData.imported.length > objectsLimit) {
                // Show limited objects with a message about total
                output.push(`      Showing ${objectsLimit} of ${categoryData.imported.length} objects:`);

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                categoryData.imported.slice(0, objectsLimit).forEach((item: any) => {
                    // Different handling based on object type
                    if (category === 'schema_definitions' && item.name) {
                        output.push(`      - Schema: ${item.name}`);
                    } else if (category === 'tables' && item.name) {
                        const schemaPrefix = item.schema ? `${item.schema}.` : '';
                        output.push(`      - Table: ${schemaPrefix}${item.name}`);
                    } else if (category === 'columns' && (item.name || item.column_name)) {
                        // Support both name and column_name properties
                        const columnName = item.name || item.column_name;
                        const tablePrefix = item.table || item.table_name ? `${item.table || item.table_name}.` : '';
                        output.push(`      - Column: ${tablePrefix}${columnName}`);
                    } else if (category === 'semantic_contexts' && item.statement) {
                        const statementPreview = item.statement.length > 50 ?
                            `${item.statement.substring(0, 50)}...` : item.statement;
                        output.push(`      - Context: ${item.scope || ''} - "${statementPreview}"`);
                    } else if (category === 'liked_queries' && item.query) {
                        const queryPreview = item.query.length > 50 ?
                            `${item.query.substring(0, 50)}...` : item.query;
                        output.push(`      - Query: "${queryPreview}"`);
                    } else if (typeof item === 'string') {
                        output.push(`      - ${item}`);
                    } else if (item.id || item.name) {
                        output.push(`      - ${item.name || item.id}`);
                    } else {
                        output.push(`      - ${JSON.stringify(item)}`);
                    }
                });

                output.push(`      ... and ${categoryData.imported.length - objectsLimit} more objects`);
            } else {
                // Show all objects when count is small or in verbose/dry run mode
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                categoryData.imported.forEach((item: any) => {
                    // Different handling based on object type
                    if (category === 'schema_definitions' && item.name) {
                        output.push(`      - Schema: ${item.name}`);
                    } else if (category === 'tables' && item.name) {
                        const schemaPrefix = item.schema ? `${item.schema}.` : '';
                        output.push(`      - Table: ${schemaPrefix}${item.name}`);
                    } else if (category === 'columns' && (item.name || item.column_name)) {
                        // Support both name and column_name properties
                        const columnName = item.name || item.column_name;
                        const tablePrefix = item.table || item.table_name ? `${item.table || item.table_name}.` : '';
                        output.push(`      - Column: ${tablePrefix}${columnName}`);
                    } else if (category === 'semantic_contexts' && item.statement) {
                        const statementPreview = item.statement.length > 50 ?
                            `${item.statement.substring(0, 50)}...` : item.statement;
                        output.push(`      - Context: ${item.scope || ''} - "${statementPreview}"`);
                    } else if (category === 'liked_queries' && item.query) {
                        const queryPreview = item.query.length > 50 ?
                            `${item.query.substring(0, 50)}...` : item.query;
                        output.push(`      - Query: "${queryPreview}"`);
                    } else if (typeof item === 'string') {
                        output.push(`      - ${item}`);
                    } else if (item.id || item.name) {
                        output.push(`      - ${item.name || item.id}`);
                    } else {
                        output.push(`      - ${JSON.stringify(item)}`);
                    }
                });
            }
        }

        // Always show ignored objects, but limit the number in normal mode (same as imported objects)
        if (ignored > 0 && Array.isArray(categoryData.ignored)) {
            output.push('\n    Ignored objects:');

            // Default limit for objects to show in normal mode
            const DEFAULT_OBJECTS_LIMIT = 20;
            const objectsLimit = verbose ? 1000 : DEFAULT_OBJECTS_LIMIT; // Only increase limit in verbose mode

            if (categoryData.ignored.length > objectsLimit) {
                // Show sample of ignored objects with a message about the total
                output.push(`      Showing ${objectsLimit} of ${categoryData.ignored.length} ignored objects:`);

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                categoryData.ignored.slice(0, objectsLimit).forEach((item: any) => {
                    // Different handling based on object type
                    if (category === 'schema_definitions' && item.name) {
                        output.push(`      - Schema: ${item.name}`);
                    } else if (category === 'tables' && item.name) {
                        const schemaPrefix = item.schema ? `${item.schema}.` : '';
                        output.push(`      - Table: ${schemaPrefix}${item.name}`);
                    } else if (category === 'columns' && (item.name || item.column_name)) {
                        // Support both name and column_name properties
                        const columnName = item.name || item.column_name;
                        const tablePrefix = item.table || item.table_name ? `${item.table || item.table_name}.` : '';
                        output.push(`      - Column: ${tablePrefix}${columnName}`);
                    } else if (category === 'semantic_contexts' && item.statement) {
                        const statementPreview = item.statement.length > 50 ?
                            `${item.statement.substring(0, 50)}...` : item.statement;
                        output.push(`      - Context: ${item.scope || ''} - "${statementPreview}"`);
                    } else if (category === 'liked_queries' && item.query) {
                        const queryPreview = item.query.length > 50 ?
                            `${item.query.substring(0, 50)}...` : item.query;
                        output.push(`      - Query: "${queryPreview}"`);
                    } else if (typeof item === 'string') {
                        output.push(`      - ${item}`);
                    } else if (item.id || item.name) {
                        output.push(`      - ${item.name || item.id}`);
                    } else {
                        output.push(`      - ${JSON.stringify(item)}`);
                    }
                });

                output.push(`      ... and ${categoryData.ignored.length - objectsLimit} more objects`);
            } else {
                // Show all objects when count is small
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                categoryData.ignored.forEach((item: any) => {
                    // Different handling based on object type
                    if (category === 'schema_definitions' && item.name) {
                        output.push(`      - Schema: ${item.name}`);
                    } else if (category === 'tables' && item.name) {
                        const schemaPrefix = item.schema ? `${item.schema}.` : '';
                        output.push(`      - Table: ${schemaPrefix}${item.name}`);
                    } else if (category === 'columns' && (item.name || item.column_name)) {
                        // Support both name and column_name properties
                        const columnName = item.name || item.column_name;
                        const tablePrefix = item.table || item.table_name ? `${item.table || item.table_name}.` : '';
                        output.push(`      - Column: ${tablePrefix}${columnName}`);
                    } else if (category === 'semantic_contexts' && item.statement) {
                        const statementPreview = item.statement.length > 50 ?
                            `${item.statement.substring(0, 50)}...` : item.statement;
                        output.push(`      - Context: ${item.scope || ''} - "${statementPreview}"`);
                    } else if (category === 'liked_queries' && item.query) {
                        const queryPreview = item.query.length > 50 ?
                            `${item.query.substring(0, 50)}...` : item.query;
                        output.push(`      - Query: "${queryPreview}"`);
                    } else if (typeof item === 'string') {
                        output.push(`      - ${item}`);
                    } else if (item.id || item.name) {
                        output.push(`      - ${item.name || item.id}`);
                    } else {
                        output.push(`      - ${JSON.stringify(item)}`);
                    }
                });
            }
        }
    }

    return output.join('\n');
}

const semanticLayerImportDoc = {
    description: 'Import semantic layer configuration for a database connection.',
    parameters: [],
    stdin: '',
    options: {
        db_conn_key: 'Required. Database connection key',
        file: 'Required. Path to the input file containing the configuration',
        format: 'Input format: auto (default), yaml, or json',
        schema_mapping: 'Optional JSON string with schema mapping',
        database_mapping: 'Optional JSON string with database mapping',
        search_context: 'Optional JSON string with search context parameters to specify which parts of the semantic layer to import',
        strict_mode: 'When true, Waii will delete all existing configurations in the target connection and import all configurations from the dump. When false, existing configurations will be preserved and only additional configurations from the dump will be imported (default: false)',
        dry_run_mode: 'When true, the system will validate and report what changes would be made without applying them (default: false)',
        detailed: 'Show full JSON response from server',
        poll_interval: 'Interval in ms to poll for import status (default: 1000)',
        timeout: 'Timeout in ms for import operation (default: 5 minutes)',
        max_retries: 'Maximum number of retries when operation status returns \'not_exists\' (default: 5).',
        verbose: 'Show verbose debug information and display detailed import statistics'
    }
};

const semanticLayerImport = async (params: CmdParams) => {
    // Required parameters
    if (!('db_conn_key' in params.opts)) {
        console.error('Error: Required option \'db_conn_key\' is missing.');
        return;
    }

    if (!('file' in params.opts)) {
        console.error('Error: Required option \'file\' is missing.');
        return;
    }

    const dbConnKey = params.opts['db_conn_key'];
    const filePath = params.opts['file'];
    const format = params.opts['format'] || 'auto';
    const pollInterval = params.opts['poll_interval'] ?
        parseInt(params.opts['poll_interval']) : 1000;
    const timeout = params.opts['timeout'] ?
        parseInt(params.opts['timeout']) : 5 * 60 * 1000; // 5 minute default timeout
    const verbose = 'verbose' in params.opts;
    const maxRetries = params.opts['max_retries'] ?
        parseInt(params.opts['max_retries']) : 5; // Default to 5 retries

    // Parse the new boolean parameters
    const strictMode = 'strict_mode' in params.opts ?
        stringToBoolean(params.opts['strict_mode']) : false;

    const dryRunMode = 'dry_run_mode' in params.opts ?
        stringToBoolean(params.opts['dry_run_mode']) : false;

    if (verbose) {
        console.log(`Options: strict_mode=${strictMode}, dry_run=${dryRunMode}`);
    }

    if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found: ${filePath}`);
        return;
    }

    // Read and parse the input file
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');

        // Auto-detect format if not specified
        let actualFormat = format;
        if (format === 'auto') {
            // Simple format detection: Check if the file starts with '{' for JSON
            const trimmed = fileContent.trim();
            actualFormat = trimmed.startsWith('{') ? 'json' : 'yaml';
        }

        const config = parseInput(fileContent, actualFormat);

        if (verbose) {
            console.log(`Input format detected as: ${actualFormat}`);
        }

        // Schema and database mappings (optional)
        const schemaMapping = params.opts['schema_mapping'] ?
            JSON.parse(params.opts['schema_mapping']) : {};
        const databaseMapping = params.opts['database_mapping'] ?
            JSON.parse(params.opts['database_mapping']) : {};

        // Search context (optional)
        const searchContext = params.opts['search_context'] ?
            JSON.parse(params.opts['search_context']) : [{
                db_name: '*',
                schema_name: '*',
                table_name: '*'
            }];

        // Start import operation
        console.log(`Starting semantic layer import for database connection '${dbConnKey}'...`);

        const importRequest: ImportSemanticLayerDumpRequest = {
            db_conn_key: dbConnKey,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            configuration: config as any,
            schema_mapping: schemaMapping,
            database_mapping: databaseMapping,
            strict_mode: strictMode,
            dry_run_mode: dryRunMode
        };

        // Add search_context if provided
        if (searchContext.length > 0) {
            importRequest.search_context = searchContext;
        }

        if (verbose) {
            console.log(`Import request: ${JSON.stringify(importRequest, null, 2)}`);
        }

        const importResp = await WAII.SemanticLayerDump.import(importRequest);
        const opId = importResp.op_id;
        console.log(`Import operation started with ID: ${opId}`);

        // Poll for status
        let status = OperationStatus.IN_PROGRESS;
        let dots = 0;
        const startTime = Date.now();
        let notExistsRetries = 0;

        process.stdout.write('Waiting for import to complete');

        while (status === OperationStatus.IN_PROGRESS || (status === OperationStatus.NOT_EXISTS && notExistsRetries < maxRetries)) {
            // Check for timeout
            if (Date.now() - startTime > timeout) {
                process.stdout.write('\n');
                console.error(`Import operation timed out after ${timeout/1000} seconds.`);
                return;
            }

            // Wait before checking again
            await sleep(pollInterval);

            try {
                // Check status
                const statusResp = await WAII.SemanticLayerDump.checkImportStatus({
                    op_id: opId
                });

                if (verbose) {
                    process.stdout.write('\n');
                    console.log(`Status response: ${JSON.stringify(statusResp)}`);
                }

                status = statusResp.status;

                if (status === OperationStatus.SUCCEEDED) {
                    process.stdout.write('\n');
                    // Indicate if this was a dry run
                    const importType = dryRunMode ? 'Import simulation (dry run)' : 'Import';
                    console.log(`${importType} completed successfully!`);

                    const resultInfo = statusResp.info;

                    if (resultInfo) {
                        // Format the import results with verbose info or if in dry run mode
                        console.log(formatImportResults(resultInfo, verbose, dryRunMode));

                        // If detailed format is requested, also show the raw data
                        if (params.opts['detailed']) {
                            console.log('\nDetailed information:');
                            console.log(JSON.stringify(resultInfo, null, 2));
                        }
                    } else {
                        console.log('Import completed but no detailed information was returned.');
                    }

                    // Break out of the loop since we've succeeded
                    break;
                } else if (status === OperationStatus.FAILED) {
                    process.stdout.write('\n');
                    console.error(`Import failed: ${statusResp.info}`);
                    return;
                } else if (status === OperationStatus.NOT_EXISTS) {
                    // Handle the "not_exists" status
                    // This can happen if:
                    // 1. The operation ID is invalid
                    // 2. The operation was completed and already queried once (server removes completed operations after querying)
                    // 3. The operation was cleaned up by the server
                    notExistsRetries++;

                    if (notExistsRetries >= maxRetries) {
                        process.stdout.write('\n');
                        console.error(`Import operation not found on server after ${maxRetries} retries. Operation ID: ${opId}`);
                        console.error('This could mean the operation was never started or was already completed and cleaned up.');
                        console.error('If this is a persistent issue, please check if the database connection is valid.');
                        return;
                    }

                    // Continue polling, but with warning in verbose mode
                    if (verbose) {
                        console.log(`Operation not found on server (retry ${notExistsRetries}/${maxRetries})...`);
                    }

                    // Use a longer sleep for not_exists retries
                    await sleep(pollInterval * 2);

                    // Keep status as "in_progress" to continue the loop
                    status = OperationStatus.IN_PROGRESS;
                } else if (status !== OperationStatus.IN_PROGRESS) {
                    // Handle unknown operation status
                    process.stdout.write('\n');
                    console.error(`Error: Received unknown operation status: "${status}"`);
                    console.error('This may indicate a version mismatch between the client and server.');
                    console.error('Please report this issue to the development team.');
                    return;
                } else {
                    // progress indicator
                    dots = (dots + 1) % 4;
                    const progressDots = '.'.repeat(dots);
                    process.stdout.write(`\rWaiting for import to complete${progressDots}${' '.repeat(4 - dots)}`);
                }
            } catch (pollError) {
                console.error(`\nError while checking import status: ${pollError}`);
                // Continue polling despite error
            }
        }
    } catch (error) {
        console.error(`Error during import: ${error}`);
    }
};

const semanticLayerDumpCommands = {
    export: { fn: semanticLayerExport, doc: semanticLayerExportDoc },
    import: { fn: semanticLayerImport, doc: semanticLayerImportDoc }
};

export { semanticLayerDumpCommands };
