import WAII from 'waii-sdk-js'
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
    SUCCEEDED: "succeeded",
    FAILED: "failed", 
    IN_PROGRESS: "in_progress",
    NOT_EXISTS: "not_exists"
};

// Sleep helper function 
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper for converting between YAML and JSON
function formatOutput(data: any, format: string): string {
    if (format === 'json') {
        return JSON.stringify(data, null, 2);
    } else {
        return YAML.stringify(data);
    }
}

function parseInput(content: string, format: string): any {
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
    description: "Export semantic layer configuration for a database connection.",
    parameters: [],
    stdin: "",
    options: {
        db_conn_key: "Required. Database connection key",
        file: "Path to the output file. If not specified, prints to stdout.",
        format: "Output format: yaml (default) or json.",
        search_context: "Optional JSON string with search context parameters",
        poll_interval: "Interval in ms to poll for export status (default: 1000)",
        timeout: "Timeout in ms for export operation (default: 300 seconds)",
        max_retries: "Maximum number of retries when operation status returns 'not_exists' (default: 3). This can happen when the server has already processed and cleared the operation.",
        verbose: "Show verbose debug information and display neatly formatted statistics"
    }
};

// Helper function to format export results
function formatExportResults(data: any, verbose: boolean = false): string {
    if (!data) {
        return 'No export data available';
    }
    
    let output = [];
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
        console.error("Error: Required option 'db_conn_key' is missing.");
        return;
    }
    
    const dbConnKey = params.opts['db_conn_key'];
    const searchContext: SearchContext[] = params.opts['search_context'] ? 
        JSON.parse(params.opts['search_context']) : [];
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
        let startTime = Date.now();
        let notExistsRetries = 0;
        
        process.stdout.write("Waiting for export to complete");
        
        while (status === OperationStatus.IN_PROGRESS || (status === OperationStatus.NOT_EXISTS && notExistsRetries < maxRetries)) {
            // Check for timeout
            if (Date.now() - startTime > timeout) {
                process.stdout.write("\n");
                console.error(`Export operation timed out after ${timeout/1000} seconds.`);
                return;
            }
            
            await sleep(pollInterval);
            
            try {
                const statusResp = await WAII.SemanticLayerDump.checkExportStatus({
                    op_id: opId
                });
                
                if (verbose) {
                    process.stdout.write("\n");
                    console.log(`Status response: ${JSON.stringify(statusResp)}`);
                }
                
                status = statusResp.status;
                
                if (status === OperationStatus.SUCCEEDED) {
                    process.stdout.write("\n");
                    console.log("Export completed successfully!");
                    result = statusResp.info;
                    if (verbose) {
                        console.log(`Result received: ${result ? 'yes' : 'no'}`);
                    }
                    
                    // Break out of the loop since we've succeeded
                    // We must save the result to 'result' variable before breaking
                    // because the server removes the operation from storage once queried (for now)
                    break;
                } else if (status === OperationStatus.FAILED) {
                    process.stdout.write("\n");
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
                        process.stdout.write("\n");
                        console.error(`Export operation not found on server after ${maxRetries} retries. Operation ID: ${opId}`);
                        console.error("This could mean the operation was never started or was already completed and cleaned up.");
                        console.error("If this is a persistent issue, please check if the database connection is valid.");
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
            console.error("Export completed but no data was returned.");
            console.error("This may indicate that the database has no exportable semantic layer configuration.");
            console.error("If you believe this is an error, try running with the --verbose flag for more details.");
            // Add more specific user guidance
            console.error("Consider checking if:");
            console.error(" - The database connection is valid and contains semantic layer configuration");
            console.error(" - Your permissions allow access to the semantic layer configuration");
            console.error(" - The search_context parameter is correctly specified (if used)");
        }
    } catch (error) {
        console.error(`Error during export: ${error}`);
    }
};

// Helper function to format import results
function formatImportResults(info: any, verbose: boolean = false, isDryRun: boolean = false): string {
    // Remove debug info
    if (!info || !info.stats) {
        return 'No detailed information available';
    }
    
    const stats = info.stats;
    let output = [];
    
    // Add message if available
    if (info.message) {
        output.push(info.message);
    }
    
    // For dry runs, add a clear heading
    if (isDryRun) {
        output.push(`\n== DRY RUN SIMULATION - NO CHANGES WERE MADE ==`);
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
        
        // If verbose mode is on or this is a dry run, list the specific objects
        if (verbose || isDryRun) {
            if (imported > 0 && Array.isArray(categoryData.imported)) {
                output.push('\n    Imported objects:');
                
                // For columns category, limit the number shown to avoid excessive output
                const MAX_COLUMNS_TO_SHOW = 20;
                
                if (category === 'columns' && categoryData.imported.length > MAX_COLUMNS_TO_SHOW) {
                    // Show sample of columns with a message about the total
                    output.push(`      Showing ${MAX_COLUMNS_TO_SHOW} of ${categoryData.imported.length} columns:`);
                    
                    categoryData.imported.slice(0, MAX_COLUMNS_TO_SHOW).forEach((item: any) => {
                        if (item.name) {
                            const tablePrefix = item.table ? `${item.table}.` : '';
                            output.push(`      - Column: ${tablePrefix}${item.name}`);
                        }
                    });
                    
                    output.push(`      ... and ${categoryData.imported.length - MAX_COLUMNS_TO_SHOW} more columns`);
                } else {
                    // Normal handling for other categories or when columns count is small
                    categoryData.imported.forEach((item: any) => {
                        // Different handling based on object type
                        if (category === 'schema_definitions' && item.name) {
                            output.push(`      - Schema: ${item.name}`);
                        } else if (category === 'tables' && item.name) {
                            const schemaPrefix = item.schema ? `${item.schema}.` : '';
                            output.push(`      - Table: ${schemaPrefix}${item.name}`);
                        } else if (category === 'columns' && item.name) {
                            const tablePrefix = item.table ? `${item.table}.` : '';
                            output.push(`      - Column: ${tablePrefix}${item.name}`);
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
            
            // In dry run mode, always show ignored objects too
            if ((verbose || isDryRun) && ignored > 0 && Array.isArray(categoryData.ignored)) {
                output.push('\n    Ignored objects:');
                
                // For columns category, limit the number shown to avoid excessive output
                const MAX_COLUMNS_TO_SHOW = 20;
                
                if (category === 'columns' && categoryData.ignored.length > MAX_COLUMNS_TO_SHOW) {
                    // Show sample of ignored columns with a message about the total
                    output.push(`      Showing ${MAX_COLUMNS_TO_SHOW} of ${categoryData.ignored.length} ignored columns:`);
                    
                    categoryData.ignored.slice(0, MAX_COLUMNS_TO_SHOW).forEach((item: any) => {
                        if (item.name) {
                            const tablePrefix = item.table ? `${item.table}.` : '';
                            output.push(`      - Column: ${tablePrefix}${item.name}`);
                        }
                    });
                    
                    output.push(`      ... and ${categoryData.ignored.length - MAX_COLUMNS_TO_SHOW} more columns`);
                } else {
                    // Normal handling for other categories or when columns count is small
                    categoryData.ignored.forEach((item: any) => {
                        // Different handling based on object type
                        if (category === 'schema_definitions' && item.name) {
                            output.push(`      - Schema: ${item.name}`);
                        } else if (category === 'tables' && item.name) {
                            const schemaPrefix = item.schema ? `${item.schema}.` : '';
                            output.push(`      - Table: ${schemaPrefix}${item.name}`);
                        } else if (category === 'columns' && item.name) {
                            const tablePrefix = item.table ? `${item.table}.` : '';
                            output.push(`      - Column: ${tablePrefix}${item.name}`);
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
    }
    
    return output.join('\n');
}

const semanticLayerImportDoc = {
    description: "Import semantic layer configuration for a database connection.",
    parameters: [],
    stdin: "",
    options: {
        db_conn_key: "Required. Database connection key",
        file: "Required. Path to the input file containing the configuration",
        format: "Input format: auto (default), yaml, or json",
        schema_mapping: "Optional JSON string with schema mapping",
        database_mapping: "Optional JSON string with database mapping",
        strict_mode: "Enable strict validation of the import configuration (default: false)",
        dry_run_mode: "Simulate the import without making actual changes and show detailed output (default: false)",
        detailed: "Show full JSON response from server",
        poll_interval: "Interval in ms to poll for import status (default: 1000)",
        timeout: "Timeout in ms for import operation (default: 5 minutes)",
        max_retries: "Maximum number of retries when operation status returns 'not_exists' (default: 5).",
        verbose: "Show verbose debug information and display detailed import statistics"
    }
};

const semanticLayerImport = async (params: CmdParams) => {
    // Required parameters
    if (!('db_conn_key' in params.opts)) {
        console.error("Error: Required option 'db_conn_key' is missing.");
        return;
    }
    
    if (!('file' in params.opts)) {
        console.error("Error: Required option 'file' is missing.");
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
        
        // Start import operation
        console.log(`Starting semantic layer import for database connection '${dbConnKey}'...`);
        
        const importRequest: ImportSemanticLayerDumpRequest = {
            db_conn_key: dbConnKey,
            configuration: config,
            schema_mapping: schemaMapping,
            database_mapping: databaseMapping,
            strict_mode: strictMode,
            dry_run_mode: dryRunMode
        };
        
        if (verbose) {
            console.log(`Import request: ${JSON.stringify(importRequest, null, 2)}`);
        }
        
        const importResp = await WAII.SemanticLayerDump.import(importRequest);
        const opId = importResp.op_id;
        console.log(`Import operation started with ID: ${opId}`);
        
        // Poll for status
        let status = OperationStatus.IN_PROGRESS;
        let dots = 0;
        let startTime = Date.now();
        let notExistsRetries = 0;
        
        process.stdout.write("Waiting for import to complete");
        
        while (status === OperationStatus.IN_PROGRESS || (status === OperationStatus.NOT_EXISTS && notExistsRetries < maxRetries)) {
            // Check for timeout
            if (Date.now() - startTime > timeout) {
                process.stdout.write("\n");
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
                    process.stdout.write("\n");
                    console.log(`Status response: ${JSON.stringify(statusResp)}`);
                }
                
                status = statusResp.status;
                
                if (status === OperationStatus.SUCCEEDED) {
                    process.stdout.write("\n");
                    // Indicate if this was a dry run
                    const importType = dryRunMode ? "Import simulation (dry run)" : "Import";
                    console.log(`${importType} completed successfully!`);
                    
                    const resultInfo = statusResp.info;
                    
                    if (resultInfo) {
                        // Format the import results with verbose info or if in dry run mode
                        const showDetails = verbose || dryRunMode;
                        console.log(formatImportResults(resultInfo, showDetails, dryRunMode));
                        
                        // If detailed format is requested, also show the raw data
                        if (params.opts['detailed']) {
                            console.log("\nDetailed information:");
                            console.log(JSON.stringify(resultInfo, null, 2));
                        }
                    } else {
                        console.log("Import completed but no detailed information was returned.");
                    }
                    
                    // Break out of the loop since we've succeeded
                    break;
                } else if (status === OperationStatus.FAILED) {
                    process.stdout.write("\n");
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
                        process.stdout.write("\n");
                        console.error(`Import operation not found on server after ${maxRetries} retries. Operation ID: ${opId}`);
                        console.error("This could mean the operation was never started or was already completed and cleaned up.");
                        console.error("If this is a persistent issue, please check if the database connection is valid.");
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
                    process.stdout.write("\n");
                    console.error(`Error: Received unknown operation status: "${status}"`);
                    console.error("This may indicate a version mismatch between the client and server.");
                    console.error("Please report this issue to the development team.");
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
