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


import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

function escapeHtmlTags(text: unknown): string {
    try {
        // Convert to string and escape all HTML-like tags, except <code>
        const str = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
        return str.replace(/<(?!code|\/code)([^>]+)>/g, '\\<$1\\>');
    } catch (error) {
        console.error('Error processing text:', error);
        return String(text || ''); // Fallback to basic string conversion or empty string
    }
}

function formatParametersAsTable(params: (string | Record<string, unknown>)[]): string {
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

function formatOptionsAsTable(options: Record<string, unknown>): string {
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

function printCommands(commands: Record<string, unknown>, level = 0, parentPath = ''): string {
    let md = '';
    for (const o in commands) {
        const currentPath = parentPath ? `${parentPath} ${o}` : o;

        if (level === 0) {
            md += `\n## ${o}\n\n`;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            md += printCommands(commands[o] as any, level + 1, o);
        } else {
            if (typeof commands[o] === 'object') {
                md += `### \`waii ${currentPath}\`\n\n`;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if ((commands[o] as any)['doc']) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const doc = (commands[o] as any)['doc'];
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateCliReference(callTree: Record<string, any>) {
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
