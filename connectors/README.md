# /connectors - API Integrations

## Purpose

This directory contains connector modules for integrating with external APIs and services. Connectors provide standardized interfaces for authentication and API calls.

## Expected File Formats

- **TypeScript (.ts)**: TypeScript connector implementations
- **Python (.py)**: Python connector implementations
- **Configuration**: May include JSON files for default configurations

## Naming Conventions

- Connector files should use kebab-case: `github-connector.ts`, `slack-connector.py`
- Connector names should reflect the service: `github`, `slack`, `openai`
- Authentication handlers should follow pattern: `authenticateGithub()`

## Connector Structure

Each connector must include:

- **Name**: Identifier for the service
- **Type**: Connection type (REST API, GraphQL, WebSocket, etc.)
- **Authentication Config**: Required credentials and auth method
- **Methods**: Available API operations

Example metadata:

```typescript
export const metadata = {
  name: "example_api",
  type: "rest",
  authType: "bearer",
  schemaVersion: "1.0",
};
```
