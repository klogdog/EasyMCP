# Task 12.1: Implement Secret Encryption

**Goal**: Secure credential storage with encryption at rest.

**Actions**:

- Extend `base/secrets.ts` with encryption: use Node.js crypto module, AES-256-GCM algorithm
- Implement key management: generate encryption key using `crypto.randomBytes(32)`, store in secure location (.env, vault, KMS)
- Add `encryptSecrets(secrets: Record<string, string>, key: Buffer): EncryptedSecrets` - returns encrypted data + IV + auth tag
- Add `decryptSecrets(encrypted: EncryptedSecrets, key: Buffer): Record<string, string>` for retrieval
- Implement secret rotation: provide `rotateSecrets(oldKey, newKey)` to re-encrypt with new key
- Add vault integration: optional integration with HashiCorp Vault or AWS Secrets Manager for key storage
- Implement audit logging: log all secret access (read/write), include timestamp, user/process, operation
- Create key derivation: use PBKDF2 to derive encryption key from passphrase if needed
- Add CLI command: `mcp-gen secrets encrypt/decrypt/rotate` for manual secret management
- Document security considerations: key storage, rotation schedule, access control

**Success Criteria**: Secrets encrypted at rest; key management implemented; vault integration optional; audit logging works; documented
