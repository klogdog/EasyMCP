# Task 3.3: Create Credential Schema Discovery

**Goal**: Automatically detect what credentials each module needs.

**Actions**:

- Extend `loader.ts` to parse credential requirements from module metadata
- Look for `metadata.credentials` field in each module: `[{ name: string, type: 'api_key'|'oauth'|'password', required: boolean, description: string }]`
- Parse TypeScript JSDoc comments: extract `@requires-credential` tags
- For Python files, parse docstrings looking for `:credential` directives
- Aggregate all requirements across modules: merge duplicates (e.g., multiple tools need same API key)
- Build CredentialRequirement array with metadata: service name, whether it's optional, validation rules
- Handle optional credentials: mark clearly in prompts, allow skipping
- Create type definitions: `interface CredentialRequirement { name: string, type: CredentialType, required: boolean, description: string, validation?: RegExp }`

**Success Criteria**: Automatically discovers all credential needs; merges duplicates; distinguishes required vs optional
