# Task 3.2: Build Secret Manager

**Goal**: Securely handle collected credentials before injecting into config.

**Actions**:

- Create `base/secrets.ts` with class SecretManager
- Implement `encrypt(value: string, key: string): string` using Node.js crypto module (AES-256-GCM)
- Implement `decrypt(encrypted: string, key: string): string` for later retrieval
- Create `generateKey(): string` for creating encryption keys (store in .env or secure vault)
- Build `toEnvironmentVariables(secrets: Record<string, string>): string[]` to convert secrets to ENV=value format
- Implement `injectIntoConfig(config: string, secrets: Record<string, string>): string` to replace ${VAR} placeholders
- Add `maskSecrets(secrets: Record<string, string>): Record<string, string>` for safe logging (show first/last 2 chars)
- Create temporary file storage: write encrypted secrets to `.secrets.encrypted` for Docker build context

**Success Criteria**: Secrets are encrypted at rest; safe to log masked values; successfully inject into config templates
