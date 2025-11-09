# /base - Generator Code

## Purpose

This directory contains the core generator code that powers the MCP server generator. It includes the main application logic, module loaders, validators, and build orchestration.

## Expected File Formats

- **TypeScript (.ts)**: Primary language for generator implementation
- **Configuration**: May include JSON or YAML files for build configurations

## Naming Conventions

- Use kebab-case for file names: `module-loader.ts`, `validator.ts`
- Use PascalCase for class names: `ModuleLoader`, `ManifestGenerator`
- Use camelCase for functions and variables: `loadModules()`, `validateSchema()`
- Main entry point should be named `main.ts`

## Key Components

This directory will contain:

- Module loader for discovering tools and connectors
- Validators for MCP schema compliance
- Manifest generator for creating server configurations
- Dockerfile generator for containerization
- Build orchestrator for Docker-in-Docker operations
