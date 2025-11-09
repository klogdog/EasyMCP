# Task Checklist for Phase 3: User Interaction & Secrets

## Overview

This phase focuses on user interaction & secrets.

## Tasks

### Task 3.1: Create Interactive Prompt System

- [ ] Create `base/prompt.ts` using inquirer library
- [ ] Export `async function promptForCredentials(requirements: CredentialRequirement[]): Promise<Record<string, string>>`
- [ ] For each requirement, create appropriate prompt type: input (text), password (masked), confirm (yes/no), list (dropdown)
- [ ] Add validation callbacks: email format, URL format, non-empty strings, numeric ranges
- [ ] Implement conditional prompts: only ask for OAuth tokens if user selects OAuth authentication method
- [ ] Add confirmation step: display all collected values (mask secrets) and ask "Proceed with these settings?"
- [ ] Support defaults from environment variables: check process.env first, use as default value if present
- [ ] Handle Ctrl+C gracefully: clean exit with message
- [ ] **Success Criteria**: Prompts are user-friendly; passwords are masked; validates input format; supports defaults


### Task 3.2: Build Secret Manager

- [ ] Create `base/secrets.ts` with class SecretManager
- [ ] Implement `encrypt(value: string, key: string): string` using Node.js crypto module (AES-256-GCM)
- [ ] Implement `decrypt(encrypted: string, key: string): string` for later retrieval
- [ ] Create `generateKey(): string` for creating encryption keys (store in .env or secure vault)
- [ ] Build `toEnvironmentVariables(secrets: Record<string, string>): string[]` to convert secrets to ENV=value format
- [ ] Implement `injectIntoConfig(config: string, secrets: Record<string, string>): string` to replace ${VAR} placeholders
- [ ] Add `maskSecrets(secrets: Record<string, string>): Record<string, string>` for safe logging (show first/last 2 chars)
- [ ] Create temporary file storage: write encrypted secrets to `.secrets.encrypted` for Docker build context
- [ ] **Success Criteria**: Secrets are encrypted at rest; safe to log masked values; successfully inject into config templates


### Task 3.3: Create Credential Schema Discovery

- [ ] Extend `loader.ts` to parse credential requirements from module metadata
- [ ] Look for `metadata.credentials` field in each module: `[{ name: string, type: 'api_key'|'oauth'|'password', required: boolean, description: string }]`
- [ ] Parse TypeScript JSDoc comments: extract `@requires-credential` tags
- [ ] For Python files, parse docstrings looking for `:credential` directives
- [ ] Aggregate all requirements across modules: merge duplicates (e.g., multiple tools need same API key)
- [ ] Build CredentialRequirement array with metadata: service name, whether it's optional, validation rules
- [ ] Handle optional credentials: mark clearly in prompts, allow skipping
- [ ] Create type definitions: `interface CredentialRequirement { name: string, type: CredentialType, required: boolean, description: string, validation?: RegExp }`
- [ ] **Success Criteria**: Automatically discovers all credential needs; merges duplicates; distinguishes required vs optional

