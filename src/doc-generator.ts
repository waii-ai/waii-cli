import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

function escapeHtmlTags(text: any): string {
    try {
        // Convert to string and escape all HTML-like tags, except <code>
        const str = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
        return str.replace(/<(?!code|\/code)([^>]+)>/g, '\\<$1\\>');
    } catch (error) {
        console.error('Error processing text:', error);
        return String(text || ''); // Fallback to basic string conversion or empty string
    }
}

function formatParametersAsTable(params: any[]): string {
    let table = '| Name | Type | Description |\n';
    table += '|------|------|-------------|\n';
    
    params.forEach(param => {
        if (typeof param === 'object') {
            const name = escapeHtmlTags(param.name || '');
            const type = escapeHtmlTags(param.type || '');
            const desc = escapeHtmlTags(param.description || '');
            table += `| ${name} | ${type} | ${desc} |\n`;
        } else {
            table += `| ${escapeHtmlTags(param)} | | |\n`;
        }
    });
    
    return table + '\n';
}

function formatOptionsAsTable(options: any): string {
    let table = '| Option | Description |\n';
    table += '|---------|-------------|\n';
    
    Object.entries(options).forEach(([key, value]) => {
        let desc: string;
        if (value && typeof value === 'object' && 'description' in value) {
            desc = value.description as string;
        } else {
            desc = String(value);
        }
        table += `| \`--${key}\` | ${escapeHtmlTags(desc)} |\n`;
    });
    
    return table + '\n';
}

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
                    md += `${escapeHtmlTags(doc.description)}\n\n`;

                    // Add parameters if they exist and are not empty
                    if (doc.parameters && doc.parameters.length > 0) {
                        md += '#### Parameters\n\n';
                        md += formatParametersAsTable(doc.parameters);
                    }

                    // Add options if they exist and are not empty
                    if (doc.options && Object.keys(doc.options).length > 0) {
                        md += '#### Options\n\n';
                        md += formatOptionsAsTable(doc.options);
                    }

                    // Add examples if they exist
                    if (doc.examples) {
                        md += '#### Examples\n\n';
                        // Replace <code> tags with triple backticks and proper newlines
                        const formattedExamples = doc.examples
                            .replace(/<code>/g, '```\n')
                            .replace(/<\/code>/g, '\n```\n');
                        md += formattedExamples + '\n\n';
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