# Waii-CLI Documentation

Waii-CLI is a powerful command-line interface (CLI) tool that generates SQL from plain text commands.

## Setup / Install Instructions

### Prerequisites:
- Node.js (version >= 16)

### Installation:

1. Make sure you have Node.js (version >= 16) installed.
   - You can check your Node.js version by running `node -v` in the terminal.
   - If you don't have Node.js installed, you can download it from [Node.js official website](https://nodejs.org/).

2. Install Waii-CLI globally using npm:

```bash
npm install -g waii-cli
```

### Commands and Subcommands

#### query:
- create: Generates a SQL statement from a natural question or statement.
- update: Updates a SQL statement with instructions given in natural language.
- explain: Provides a detailed natural language breakdown of a given SQL query.
- describe: Describes the structure of a specific query.
- rewrite: Modifies an existing SQL query based on best practices.
- transcode: Transforms a given query to another SQL dialect.
- diff: Compares two SQL queries and highlights the differences.
- run: Executes the generated SQL query.

#### database:
- list: Displays a list of available databases.
- add: Lets you add a new database.
- delete: Delete a database connection.
- activate: Sets a specific database as the active working database.
- describe: Describes the structure and metadata of a specified database.

#### context:
- list: Lists the current semantic context.
- add: Adds a new statement to the semantic context.
- delete: Removes a statement from the semantic context.

#### history:
- list: Displays a list of recent SQL commands and queries.