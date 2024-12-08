import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

function printCommands(commands: any, level: number = 0, parentPath: string = ''): string {
    let md = '';
    for (const o in commands) {
        const currentPath = parentPath ? `${parentPath} ${o}` : o;
        
        if (level === 0) {
            md += `\n## ${o}\n\n`;
            md += printCommands(commands[o], level + 1, o);
        } else {
            if (typeof commands[o] === 'object') {
                md += `### \`waii ${currentPath}\`\n\n`;
                if (commands[o]['doc']) {
                    const doc = commands[o]['doc'];
                    md += `${doc.description}\n\n`;

                    // Add parameters if they exist and are not empty
                    if (doc.parameters && doc.parameters.length > 0) {
                        md += '#### Parameters\n\n';
                        // Handle different parameter formats
                        if (typeof doc.parameters === 'string') {
                            const params = doc.parameters.split(',').map((p: string) => p.trim());
                            params.forEach((param: string) => {
                                const [name, desc] = param.split(':').map((p: string) => p.trim());
                                if (name && desc) {
                                    md += `${name} - ${desc}\n\n`;
                                }
                            });
                        } else if (Array.isArray(doc.parameters)) {
                            doc.parameters.forEach((param: any) => {
                                if (typeof param === 'object') {
                                    // Handle object format parameters
                                    if (param.name && param.description) {
                                        md += `${param.name} - ${param.description}\n\n`;
                                    }
                                } else if (typeof param === 'string') {
                                    md += `${param}\n\n`;
                                }
                            });
                        }
                    }

                    // Add options if they exist and are not empty
                    if (doc.options && Object.keys(doc.options).length > 0) {
                        md += '#### Options\n\n';
                        for (const opt in doc.options) {
                            const optValue = doc.options[opt];
                            if (typeof optValue === 'object') {
                                // Handle object format options
                                md += `- \`--${opt}\`: ${optValue.description || JSON.stringify(optValue)}\n`;
                            } else {
                                md += `- \`--${opt}\`: ${optValue}\n`;
                            }
                        }
                        md += '\n';
                    }

                    // Add examples if they exist
                    if (doc.examples) {
                        md += '#### Examples\n\n';
                        // Replace <code> tags with triple backticks and proper newlines
                        const formattedExamples = doc.examples
                            .replace(/<code>/g, '```\n')
                            .replace(/<\/code>/g, '\n```\n');
                        md += `${formattedExamples}\n\n`;
                    }
                }
                md += '---\n\n';
            }
        }
    }
    return md;
}

function generateMarkdown(callTree: any): string {
    let md = '# WAII CLI Reference\n\n';
    
    // Introduction
    md += 'The WAII CLI provides a command-line interface for interacting with WAII services.\n\n';
    
    // Table of Contents
    md += '## Table of Contents\n\n';
    
    // Generate TOC entries for each top-level command
    for (const command in callTree) {
        md += `- [${command}](#${command.toLowerCase()})\n`;
        // Add subcommands if they exist
        if (typeof callTree[command] === 'object') {
            for (const subcommand in callTree[command]) {
                if (typeof callTree[command][subcommand] === 'object' && callTree[command][subcommand].doc) {
                    md += `  - [\`waii ${command} ${subcommand}\`](#waii-${command}-${subcommand})\n`;
                }
            }
        }
    }
    md += '\n';
    
    // Commands documentation
    md += '## Available Commands\n\n';
    md += printCommands(callTree);
    
    // Examples
    md += '## Common Examples\n\n';
    md += '```bash\n';
    md += 'waii database list\n';
    md += 'waii database list --format json\n';
    md += 'waii context list\n';
    md += 'waii context list --format json\n';
    md += 'waii schema describe schema_name\n';
    md += 'waii table describe schema_name.table_name\n';
    md += 'waii history\n';
    md += 'waii history list --format json\n';
    md += '```\n\n';
    
    return md;
}

function ensureDirectoryExists(filePath: string) {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}

function generateCliReference(callTree: any) {
    const outputPath = 'doc/docs/waii-cli-reference.md';
    const markdown = generateMarkdown(callTree);
    
    try {
        ensureDirectoryExists(outputPath);
        writeFileSync(outputPath, markdown, 'utf8');
        console.log(`Successfully generated CLI reference at: ${process.cwd()}/${outputPath}`);
    } catch (error) {
        console.error('Error generating documentation:', error);
        throw error;
    }
}

// Export the function to be called from waii-cli with its callTree
export { generateCliReference }; 