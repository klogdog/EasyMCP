## Create a new git branch for the task from Phase3 and merge back into Phase3 when finished

# Work Notes - Task 3.3: Create Credential Schema Discovery

## Current Status

**Task 3.2 (Build Secret Manager)** has been **COMPLETED** ✅

### What Was Done in Task 3.2

The previous agent successfully completed all requirements for the secret manager.

**Key accomplishments:**
- ✅ Created `base/secrets.ts` with SecretManager class
- ✅ Implemented AES-256-GCM encryption/decryption with random IVs
- ✅ Added generateKey() for secure key generation
- ✅ Implemented toEnvironmentVariables() with SCREAMING_SNAKE_CASE conversion
- ✅ Implemented injectIntoConfig() for ${VAR} placeholder replacement
- ✅ Added maskSecrets() for safe logging (ab****xy format)
- ✅ Implemented saveEncrypted/loadEncrypted for file storage
- ✅ Created comprehensive test suite with 8 test scenarios - all passing
- ✅ Updated documentation and merged to Phase3

Full details in: `/workspace/ActionPlan/Phase3/Task2/TaskCompleteNote2.md`

## Your Task: Task 3.3 - Create Credential Schema Discovery

**Goal**: Automatically discover credential requirements from module metadata and code comments.

### Key Requirements:

1. Extend `loader.ts` to parse credential requirements from module metadata
2. Look for `metadata.credentials` field in each module
3. Parse TypeScript JSDoc comments for `@requires-credential` tags
4. Parse Python docstrings for `:credential` directives
5. Aggregate requirements across modules (merge duplicates)
6. Build CredentialRequirement array with metadata
7. Handle optional vs required credentials
8. Create type definitions for CredentialRequirement

See full implementation details in:
- `/workspace/ActionPlan/Phase3/Task3/Task3.md`
- `/workspace/ActionPlan/Phase3/TaskCheckList3.md`

### Quick Start:

```bash
git checkout Phase3
git checkout -b task-3.3
# Extend base/loader.ts with credential discovery
# Create comprehensive tests
npm run build && node dist/test-loader.js
# Update documentation
git commit -am "Complete Task 3.3"
git checkout Phase3 && git merge --no-ff task-3.3
# Update WorkNotes.md for next phase
```

### Reference Files:
- Prompt system: `/workspace/base/prompt.ts`
- Secret manager: `/workspace/base/secrets.ts`
- Current loader: `/workspace/base/loader.ts`
- Checklist: `/workspace/ActionPlan/Phase3/TaskCheckList3.md`
