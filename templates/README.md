# /templates - Code Generation Templates

## Purpose

This directory contains templates for generating MCP server code, Dockerfiles, and configuration files. Templates use placeholders that are replaced with actual values during generation.

## Expected File Formats

- **Handlebars (.hbs)**: Handlebars template files
- **TypeScript (.ts.template)**: TypeScript code templates
- **Dockerfile (.dockerfile.template)**: Dockerfile templates
- **JSON/YAML (.json.template, .yaml.template)**: Config templates

## Naming Conventions

- Template files should indicate their purpose: `server.ts.template`, `Dockerfile.template`
- Use `.template` extension to distinguish from regular files
- Keep template names simple and descriptive

## Template Variables

Common placeholders used in templates:

- `{{serverName}}`: Name of the generated MCP server
- `{{tools}}`: Array of tool configurations
- `{{connectors}}`: Array of connector configurations
- `{{dependencies}}`: NPM package dependencies
- `{{environmentVars}}`: Environment variable definitions

## Template Types

Expected templates:

- **Server entry point**: Main application template
- **Dockerfile**: Container build instructions
- **package.json**: NPM package configuration
- **Tool wrapper**: Code for loading and executing tools
- **Connector wrapper**: Code for initializing connectors
