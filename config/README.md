# /config - Runtime Configurations

## Purpose

This directory contains runtime configuration files that control how MCP servers are generated and deployed. Configurations define which tools and connectors to include, environment variables, and deployment settings.

## Expected File Formats

- **YAML (.yaml, .yml)**: Primary format for server configurations
- **JSON (.json)**: Alternative format for configuration data
- **ENV (.env)**: Environment variable templates

## Naming Conventions

- Config files should be descriptive: `server-config.yaml`, `production.yaml`
- Environment files: `.env.template`, `.env.example`
- Use lowercase with hyphens for consistency

## Configuration Structure

A typical server configuration includes:

- **Server metadata**: Name, version, description
- **Tools**: List of tool modules to include
- **Connectors**: List of connectors to enable
- **Environment variables**: Required and optional env vars
- **Build options**: Docker build settings, resource limits

Example structure:

```yaml
server:
  name: my-mcp-server
  version: 1.0.0
tools:
  - file-reader
  - api-caller
connectors:
  - github
environment:
  NODE_ENV: production
```
