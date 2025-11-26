# Work Notes - Phase 12: Security & Hardening

## Overview

Phase 12 focuses on implementing comprehensive security measures and hardening the EasyMCP platform for production use. This phase addresses four critical security areas: secret encryption at rest, automated security scanning, security documentation, and role-based access control (RBAC). Together, these components create a defense-in-depth security posture.

---

## Current Status

**Phase Status**: 🔄 In Progress

### Prerequisites

Before starting Phase 12, ensure:

- Phases 1-11 are complete
- Core generator is functional
- Docker integration is working
- `base/secrets.ts` exists with basic SecretManager class

### Existing Implementation

The `base/secrets.ts` file already provides:

- ✅ AES-256-GCM authenticated encryption
- ✅ Random IV generation for each encryption
- ✅ Key generation via `crypto.randomBytes(32)`
- ✅ Encryption/decryption with `encrypt()` and `decrypt()` methods
- ✅ Environment variable conversion
- ✅ Config template injection
- ✅ Secret masking for safe logging
- ✅ File-based encrypted storage with `saveEncrypted()` and `loadEncrypted()`

---

## Task Summary

| Task | Description                     | Complexity | Status      | Dependencies              |
| ---- | ------------------------------- | ---------- | ----------- | ------------------------- |
| 12.1 | Implement Secret Encryption     | High       | Partial ✓   | base/secrets.ts           |
| 12.2 | Add Security Scanning           | Medium     | Not Started | Docker, npm/pip           |
| 12.3 | Create Security Hardening Guide | Medium     | Not Started | docs/ folder              |
| 12.4 | Implement RBAC for Tools        | High       | Not Started | Authentication middleware |

---

## Task 12.1: Implement Secret Encryption

### Goal

Secure credential storage with encryption at rest, key management, and audit logging.

### Current State Analysis

**Already Implemented in `base/secrets.ts`:**

- `SecretManager` class with AES-256-GCM encryption
- `encrypt(value: string): string` - Returns `iv:encrypted:authTag` format
- `decrypt(encrypted: string): string` - Parses and decrypts
- `generateKey(): string` - Generates 256-bit random key
- `saveEncrypted()` / `loadEncrypted()` - File-based storage
- `toEnvironmentVariables()` - Convert to env var format
- `injectIntoConfig()` - Template injection
- `maskSecrets()` - Safe logging

**Still Needed:**

- [ ] Secret rotation: `rotateSecrets(oldKey, newKey)` to re-encrypt with new key
- [ ] Vault integration: HashiCorp Vault or AWS Secrets Manager (optional)
- [ ] Audit logging: log all secret access with timestamp, user/process, operation
- [ ] Key derivation: PBKDF2 for deriving key from passphrase
- [ ] CLI command: `mcp-gen secrets encrypt/decrypt/rotate`
- [ ] Security documentation

### Implementation Plan

1. **Add Secret Rotation**

   ```typescript
   async rotateSecrets(
     filepath: string,
     oldKey: string,
     newKey: string
   ): Promise<void> {
     // Load with old key
     const oldManager = new SecretManager(oldKey);
     const secrets = await oldManager.loadEncrypted(filepath);

     // Save with new key
     const newManager = new SecretManager(newKey);
     await newManager.saveEncrypted(secrets, filepath);
   }
   ```

2. **Add Audit Logging**

   ```typescript
   interface AuditLogEntry {
     timestamp: Date;
     operation: "read" | "write" | "encrypt" | "decrypt" | "rotate";
     process: string;
     user?: string;
     filepath?: string;
     success: boolean;
   }
   ```

3. **Add PBKDF2 Key Derivation**

   ```typescript
   static deriveKeyFromPassphrase(
     passphrase: string,
     salt: Buffer,
     iterations: number = 100000
   ): Buffer {
     return crypto.pbkdf2Sync(passphrase, salt, iterations, 32, 'sha256');
   }
   ```

4. **Vault Integration (Optional)**
   - Abstract vault interface for pluggable backends
   - Support HashiCorp Vault, AWS Secrets Manager, Azure Key Vault

### Success Criteria

- [x] Secrets encrypted at rest (DONE)
- [x] Key management implemented (DONE)
- [ ] Secret rotation works
- [ ] Vault integration optional
- [ ] Audit logging works
- [ ] Security considerations documented

---

## Task 12.2: Add Security Scanning

### Goal

Automated security vulnerability detection for containers, dependencies, and code.

### Key Implementation Areas

1. **Container Scanning with Trivy**

   ```bash
   # Install Trivy in CI or development
   trivy image --severity HIGH,CRITICAL <image-name>

   # Exit with error if vulnerabilities found
   trivy image --exit-code 1 --severity HIGH,CRITICAL <image-name>
   ```

2. **Dependency Scanning**
   - Node.js: `npm audit --json`
   - Python: `pip-audit` or `safety check`
   - Integrate into build process

3. **SAST (Static Analysis)**
   - Semgrep for pattern-based security checks
   - ESLint security plugins for TypeScript
   - Bandit for Python

4. **Dockerfile Best Practices Validation**

   ```typescript
   function validateDockerfile(dockerfile: string): SecurityIssue[] {
     const issues: SecurityIssue[] = [];

     // Check for non-root user
     if (!dockerfile.includes("USER")) {
       issues.push({ severity: "HIGH", message: "Container runs as root" });
     }

     // Check for secrets in ENV
     if (/ENV.*(?:KEY|SECRET|PASSWORD)/i.test(dockerfile)) {
       issues.push({
         severity: "CRITICAL",
         message: "Secrets may be hardcoded",
       });
     }

     return issues;
   }
   ```

5. **CI Integration**
   ```yaml
   # .github/workflows/security.yml
   jobs:
     security-scan:
       runs-on: ubuntu-latest
       steps:
         - uses: aquasecurity/trivy-action@master
           with:
             image-ref: "${{ env.IMAGE_NAME }}"
             exit-code: "1"
             severity: "HIGH,CRITICAL"
   ```

### Files to Create

- `base/security-scanner.ts` - Security scanning orchestrator
- `.github/workflows/security.yml` - CI security checks
- `security-allowlist.json` - Known false positives

### Success Criteria

- [ ] Container scanning works with Trivy
- [ ] Dependency checks integrated (npm audit, pip-audit)
- [ ] SAST functional with Semgrep/ESLint
- [ ] JSON/HTML security reports generated
- [ ] CI integration complete

---

## Task 12.3: Create Security Hardening Guide

### Goal

Comprehensive documentation for securing MCP servers in production.

### Document Structure

Create `docs/security.md` with the following sections:

1. **Overview & Security Model**
   - Defense-in-depth approach
   - Trust boundaries
   - Threat model

2. **Least Privilege Configuration**

   ```dockerfile
   # Run as non-root user
   FROM node:20-alpine
   RUN addgroup -g 1001 mcp && adduser -u 1001 -G mcp -s /bin/sh -D mcp
   USER mcp

   # Drop capabilities
   # docker run --cap-drop=ALL --cap-add=NET_BIND_SERVICE
   ```

3. **Network Isolation**
   - Docker network configurations
   - Firewall rules
   - Egress filtering
   - mTLS for service-to-service communication

4. **Secret Management**
   - Never hardcode secrets
   - Use environment variables
   - Vault integration patterns
   - Secret rotation procedures

5. **Authentication & Authorization**
   - API key authentication
   - OAuth2/JWT patterns
   - RBAC implementation
   - Mutual TLS

6. **Input Validation**
   - Schema validation with Zod/Joi
   - Injection prevention (SQL, command, XSS)
   - Rate limiting

7. **Security Headers**

   ```typescript
   // HTTP response headers
   app.use((req, res, next) => {
     res.setHeader("Strict-Transport-Security", "max-age=31536000");
     res.setHeader("X-Content-Type-Options", "nosniff");
     res.setHeader("X-Frame-Options", "DENY");
     next();
   });
   ```

8. **Pre-Deployment Checklist**
   - [ ] Running as non-root user
   - [ ] Secrets encrypted at rest
   - [ ] No secrets in Docker layers
   - [ ] Network isolation configured
   - [ ] Rate limiting enabled
   - [ ] Logging and audit trails active

9. **Incident Response**
   - Logging for forensics
   - Audit trails
   - Breach notification procedures

10. **Compliance Considerations**
    - GDPR data handling
    - SOC2 controls
    - HIPAA requirements

### Success Criteria

- [ ] Comprehensive security guide created
- [ ] Covers authentication, network, secrets
- [ ] Includes security checklist
- [ ] Compliance guidance included

---

## Task 12.4: Implement RBAC for Tools

### Goal

Add role-based access control to restrict tool access by user/role.

### Architecture Design

```
┌──────────────────────────────────────────────────────────┐
│                    MCP Server                             │
├──────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌──────────────┐    ┌────────────┐  │
│  │   Request   │───>│ Auth Middleware│───>│ RBAC Check │  │
│  │   (API Key) │    │ (Extract User)│    │ (Authorize)│  │
│  └─────────────┘    └──────────────┘    └────────────┘  │
│                                              │            │
│                                              ▼            │
│                            ┌─────────────────────────────┤
│                            │ Tool Invocation (if allowed)│
│                            └─────────────────────────────┤
└──────────────────────────────────────────────────────────┘
```

### Implementation Plan

1. **Create `base/rbac.ts`**

   ```typescript
   interface Permission {
     resource: string; // e.g., 'email', 'database', 'file'
     action: string; // e.g., 'read', 'write', 'execute'
   }

   interface Role {
     name: string;
     permissions: Permission[];
     inherits?: string[]; // Role inheritance
   }

   interface User {
     id: string;
     roles: string[];
     apiKey?: string;
   }

   class RBACManager {
     private roles: Map<string, Role>;
     private users: Map<string, User>;

     hasPermission(userId: string, permission: Permission): boolean;
     checkToolAccess(userId: string, toolName: string): boolean;
     addRole(role: Role): void;
     assignRole(userId: string, roleName: string): void;
   }
   ```

2. **Permission Model**
   - Each tool declares required permissions:
     ```typescript
     export const metadata = {
       name: "send-email",
       permissions: [{ resource: "email", action: "send" }],
     };
     ```

3. **Authentication Middleware**

   ```typescript
   async function authMiddleware(req: Request): User | null {
     const apiKey = req.headers["x-api-key"];
     if (!apiKey) return null;

     const user = await userStore.findByApiKey(apiKey);
     return user;
   }
   ```

4. **Authorization Check**

   ```typescript
   function authorizeToolInvocation(
     user: User,
     toolName: string,
     rbac: RBACManager
   ): boolean {
     const tool = toolRegistry.get(toolName);
     if (!tool?.metadata?.permissions) return true;

     return tool.metadata.permissions.every((perm) =>
       rbac.hasPermission(user.id, perm)
     );
   }
   ```

5. **Configuration Format**

   ```yaml
   rbac:
     roles:
       admin:
         permissions: ["*"]
       user:
         permissions:
           - resource: "email"
             action: "read"
           - resource: "database"
             action: "query"
       readonly:
         permissions:
           - resource: "*"
             action: "read"
     users:
       alice:
         roles: ["admin"]
         apiKey: "xxx"
       bob:
         roles: ["user"]
         apiKey: "yyy"
   ```

6. **Audit Logging**
   ```typescript
   interface AuthorizationLog {
     timestamp: Date;
     userId: string;
     toolName: string;
     requiredPermissions: Permission[];
     granted: boolean;
     reason?: string;
   }
   ```

### Default Roles

| Role     | Permissions                             |
| -------- | --------------------------------------- |
| admin    | All permissions (`*`)                   |
| user     | Basic tools, email:read, database:query |
| readonly | Read-only access to all resources       |

### Files to Create

- `base/rbac.ts` - RBAC system implementation
- `base/test-rbac.ts` - Test suite
- `docs/rbac.md` - RBAC setup documentation

### Success Criteria

- [ ] RBAC system functional
- [ ] Roles and permissions configurable
- [ ] Authorization enforced before tool invocation
- [ ] Audit logging works
- [ ] Documentation complete

---

## Development Workflow

### Branch Strategy

```bash
# Create Phase12 branch from main
git checkout main
git checkout -b Phase12

# Create task branches
git checkout -b task-12.1  # Secret Encryption
git checkout -b task-12.2  # Security Scanning
git checkout -b task-12.3  # Security Guide
git checkout -b task-12.4  # RBAC

# Merge back after each task
git checkout Phase12 && git merge --no-ff task-12.x
```

### Testing Approach

1. **Task 12.1**: Extend `base/test-secrets.ts` with rotation, audit, PBKDF2 tests
2. **Task 12.2**: Create `base/test-security-scanner.ts` with mocked Trivy/npm audit
3. **Task 12.3**: Manual review of documentation completeness
4. **Task 12.4**: Create `base/test-rbac.ts` with permission and authorization tests

---

## Dependencies & Tools

### Required Tools

- **Trivy**: Container vulnerability scanner (`brew install trivy` or Docker)
- **npm audit**: Built-in Node.js dependency scanner
- **pip-audit**: Python dependency scanner
- **Semgrep**: Static analysis (`pip install semgrep`)

### Optional Integrations

- HashiCorp Vault for enterprise secret management
- AWS Secrets Manager / Azure Key Vault
- SonarQube for comprehensive code analysis
- Snyk for vulnerability management

---

## Security Considerations

### Key Storage

- Never commit encryption keys to version control
- Use environment variables for key storage
- Consider HSM/KMS for production environments
- Implement key rotation schedule (quarterly recommended)

### Audit Trail

- Log all security-sensitive operations
- Store logs in append-only format
- Consider log shipping to SIEM
- Retain logs per compliance requirements

### Defense in Depth

1. **Network**: Isolation, firewalls, mTLS
2. **Application**: Input validation, RBAC, rate limiting
3. **Data**: Encryption at rest, secret masking
4. **Operations**: Audit logging, monitoring, alerting

---

## Quick Reference

### Files to Create/Modify

| File                             | Task | Description                    |
| -------------------------------- | ---- | ------------------------------ |
| `base/secrets.ts`                | 12.1 | Add rotation, audit, PBKDF2    |
| `base/security-scanner.ts`       | 12.2 | Security scanning orchestrator |
| `docs/security.md`               | 12.3 | Security hardening guide       |
| `base/rbac.ts`                   | 12.4 | RBAC implementation            |
| `.github/workflows/security.yml` | 12.2 | CI security checks             |

### Commands

```bash
# Run secret tests
npm run build && node dist/test-secrets.js

# Run Trivy scan
trivy image --severity HIGH,CRITICAL <image-name>

# Run npm audit
npm audit --json

# Run Semgrep
semgrep --config=auto .
```

---

## Notes & Decisions

### Design Decisions

1. **PBKDF2 over bcrypt**: Using PBKDF2 for key derivation because it's built into Node.js crypto module without external dependencies.

2. **Optional Vault Integration**: Vault integration is optional to keep the core simple while supporting enterprise use cases.

3. **Permission Granularity**: Using `resource:action` format (e.g., `email:send`) for fine-grained control without excessive complexity.

4. **Audit Log Storage**: Initially file-based, with hooks for external logging systems.

### Open Questions

- [ ] Should RBAC support time-based permissions (e.g., temporary access)?
- [ ] What's the default behavior when no RBAC config exists (allow all vs deny all)?
- [ ] Should we support permission wildcards (e.g., `email:*`)?

---

## Phase Completion Checklist

- [ ] Task 12.1: Secret Encryption extended (rotation, audit, PBKDF2)
- [ ] Task 12.2: Security Scanning integrated (Trivy, npm audit, SAST)
- [ ] Task 12.3: Security Hardening Guide created (`docs/security.md`)
- [ ] Task 12.4: RBAC system implemented (`base/rbac.ts`)
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Code reviewed and merged to Phase12 branch
- [ ] Phase12 merged to main
