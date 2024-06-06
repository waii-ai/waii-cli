---
id: commands
title: CLI Commands
---

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
- extract_doc: Extract database documentation.

#### context:
- list: Lists the current semantic context.
- add: Adds a new statement to the semantic context.
- delete: Removes a statement from the semantic context.
- delete_all: Delete all added semantic contexts from the database.

#### schema:
- describe: Show the details of a schema.
- list: Show all available schemas.
- update: Update the textual description of a schema.
- update_summary: Update the textual summary of a schema.

#### history:
- list: Displays a list of recent SQL commands and queries.
