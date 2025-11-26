# Work Notes - Phase 13: CI/CD & Automation

## Current Status

**Phase 13** is **NOT STARTED** ⏳

**Phase 12 (Security & Hardening)** should be **COMPLETE** before starting Phase 13.

---

## Current Project State Analysis

### Existing CI/CD Components

| Component            | Status           | Location        | Notes                                                   |
| -------------------- | ---------------- | --------------- | ------------------------------------------------------- |
| `.github/workflows/` | ❌ Missing       | N/A             | No GitHub Actions workflow exists                       |
| Test script          | ⚠️ Stub          | `package.json`  | `"test": "echo \"Error: no test specified\" && exit 1"` |
| Docker image         | ✅ Ready         | `Dockerfile`    | Production-ready, node:20-alpine based                  |
| ESLint               | ✅ Installed     | `package.json`  | `eslint ^8.56.0` with TypeScript support                |
| Prettier             | ✅ Installed     | `package.json`  | `prettier ^3.1.1` with format scripts                   |
| Husky                | ❌ Not installed | N/A             | Needs to be added                                       |
| lint-staged          | ❌ Not installed | N/A             | Needs to be added                                       |
| Template CI          | ❌ Missing       | `templates/ci/` | Directory doesn't exist                                 |

### Package.json Scripts (Current)

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/main.js",
    "dev": "tsc --watch",
    "test": "echo \"Error: no test specified\" && exit 1",
    "lint": "eslint . --ext .ts",
    "format": "prettier --write \"**/*.{ts,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,json,md}\""
  }
}
```

### Dockerfile (Current)

The existing Dockerfile is production-ready:

- Base: `node:20-alpine`
- Includes Docker CLI for DinD operations
- Uses `npm ci --only=production`
- Sets `NODE_ENV=production`
- Entry point: `node dist/main.js`

---

### What Should Be Completed in Phase 12

- **Task 12.1**: Implement Secret Encryption
  - Extended `base/secrets.ts` with AES-256-GCM encryption
  - Key management with `crypto.randomBytes(32)`
  - Functions: `encryptSecrets()`, `decryptSecrets()`, `rotateSecrets()`
  - Optional vault integration (HashiCorp Vault, AWS Secrets Manager)
  - Audit logging for secret access
  - Key derivation with PBKDF2
  - CLI commands: `mcp-gen secrets encrypt/decrypt/rotate`

- **Task 12.2**: Add Security Scanning
  - Container scanning with Trivy/Grype
  - Dependency scanning (npm audit, safety)
  - SAST integration (Semgrep/SonarQube)
  - Dockerfile security validation
  - JSON/HTML security reports
  - CI integration for blocking vulnerable PRs

- **Task 12.3**: Create Security Hardening Guide
  - Created `docs/security.md`
  - Least-privilege configurations (non-root containers)
  - Network isolation patterns
  - Secret management best practices
  - Authentication recommendations (API keys, OAuth, mTLS)
  - Input validation, rate limiting, security headers
  - Security checklist and compliance guidance (GDPR, SOC2, HIPAA)

- **Task 12.4**: Implement RBAC for Tools
  - Created `base/rbac.ts` with RBAC system
  - Permission model: `email:read`, `email:send`, `data:query`, etc.
  - Role definitions with inheritance
  - Permission checking middleware
  - JWT/API key authentication
  - Audit logging for authorization decisions
  - Default roles: admin, user, readonly

---

## Phase 13 Overview

**Goal**: Implement CI/CD automation for testing, building, publishing, and deployment.

Phase 13 builds on the security foundation from Phase 12 to create automated pipelines that:

1. Test and validate code on every push/PR
2. Build and publish Docker images
3. Enforce code quality with pre-commit hooks
4. Provide reusable CI templates for generated MCP servers

---

## Task 13.1: Create GitHub Actions Workflow

**Branch**: `task-13.1` from `Phase13`  
**Goal**: Automate testing, building, and publishing of the generator image.

### Prerequisites from Phase 12:

- Security scanning tools (Trivy) ready for integration
- Dependency scanning (npm audit) configured

### Requirements:

1. **Create `.github/workflows/ci.yml`**

2. **Configure Workflow Triggers**:

   ```yaml
   on:
     push:
       branches: [main]
     pull_request:
       branches: [main]
     push:
       tags: ['v*']
     workflow_dispatch:  # Manual trigger
   ```

3. **Implement Test Job**:
   - Checkout code
   - Setup Node.js 20
   - Cache npm dependencies
   - Run `npm install`
   - Run `npm test`
   - Upload coverage to Codecov

4. **Implement Build Job**:
   - Use Docker buildx for multi-platform builds
   - Build for `linux/amd64` and `linux/arm64`
   - Cache Docker layers for faster builds

5. **Add Security Scanning Job**:
   - Run Trivy on built image
   - Fail on HIGH/CRITICAL vulnerabilities
   - Upload results to GitHub Security tab (SARIF format)

6. **Implement Docker Publish**:
   - Trigger on version tags (`v*`)
   - Push to Docker Hub and GHCR
   - Use GitHub secrets for credentials:
     - `DOCKER_USERNAME`
     - `DOCKER_TOKEN`
     - `GHCR_TOKEN` (or use `GITHUB_TOKEN`)

7. **Add Version Tagging**:
   - Extract version from git tag
   - Tag images: `latest`, `v1.2.3`, `v1.2`, `v1`

8. **Include Release Automation**:
   - On tag push, create GitHub Release
   - Generate changelog from commits
   - Attach build artifacts

9. **Add Workflow Badges to README**:
   - Build status
   - Code coverage
   - Security scan results

### Files to Create:

- `.github/workflows/ci.yml`
- Update `README.md` with badges

### Success Criteria:

- CI workflow runs on push/PR
- Tests pass and coverage uploaded
- Images built for multi-platform
- Security scan integrated
- Releases automated on tags
- Documentation complete

---

## Task 13.2: Build Example CI Pipeline

**Branch**: `task-13.2` from `Phase13`  
**Goal**: Provide a template CI pipeline for generated MCP servers.

### Requirements:

1. **Create `templates/ci/github-actions.yml.template`**

2. **Add Automated Tool Validation**:

   ```yaml
   validate:
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v4
       - run: mcp-gen validate
   ```

3. **Implement Integration Testing**:
   - Build test MCP server in CI
   - Start container with docker-compose
   - Run test suite against running server
   - Cleanup after tests

4. **Include Security Scanning**:
   - Scan generated server image with Trivy
   - Check dependencies for vulnerabilities
   - Block merge if critical issues found

5. **Add Deployment Automation**:
   - On merge to main → build production image
   - Push to container registry
   - Deploy to staging environment
   - Template support for: K8s, ECS, Cloud Run

6. **Implement Rollback Procedures**:
   - Health check endpoints
   - Automatic rollback on failed health checks
   - Keep previous version tagged

7. **Add Smoke Tests**:
   - Post-deployment validation
   - Call key MCP endpoints
   - Verify expected responses

8. **Create Deployment Notifications**:
   - Slack/Discord webhook integration
   - Notify on success/failure
   - Include deployment details

9. **Include Environment Promotion**:
   - Manual approval for staging → production
   - Use GitHub Environments

10. **Add Performance Benchmarks**:
    - Run load tests (k6, wrk)
    - Compare to baseline metrics
    - Flag performance regressions

### Files to Create:

- `templates/ci/github-actions.yml.template`
- `templates/ci/docker-compose.test.yml.template`
- `docs/ci-pipeline.md` (customization guide)

### Success Criteria:

- Template CI pipeline complete
- Validates tools/connectors
- Runs integration tests
- Automates deployment
- Includes rollback capability
- Fully documented

---

## Task 13.3: Create Pre-commit Hooks

**Branch**: `task-13.3` from `Phase13`  
**Goal**: Enforce code quality and standards before commits.

### Requirements:

1. **Install Dependencies**:

   ```bash
   npm install --save-dev husky lint-staged @commitlint/cli @commitlint/config-conventional
   ```

2. **Configure Husky**:

   ```bash
   npx husky init
   ```

3. **Create Pre-commit Hook** (`.husky/pre-commit`):

   ```bash
   #!/usr/bin/env sh
   . "$(dirname -- "$0")/_/husky.sh"
   npx lint-staged
   ```

4. **Configure lint-staged in `package.json`**:

   ```json
   {
     "lint-staged": {
       "*.ts": ["eslint --fix", "prettier --write"],
       "*.{json,md,yml,yaml}": ["prettier --write"]
     }
   }
   ```

5. **Add Commit Message Validation**:
   - Create `commitlint.config.js`:
     ```javascript
     module.exports = {
       extends: ["@commitlint/config-conventional"],
     };
     ```
   - Create `.husky/commit-msg`:
     ```bash
     #!/usr/bin/env sh
     . "$(dirname -- "$0")/_/husky.sh"
     npx --no -- commitlint --edit ${1}
     ```

6. **Include Security Checks**:
   - Run `npm audit` in pre-commit (optional, can be slow)
   - Add to CI as fallback

7. **Create Bypass Documentation**:
   - Document `--no-verify` for emergencies
   - Explain when bypass is appropriate

8. **Add Documentation Checks** (Optional):
   - Verify JSDoc comments for public functions
   - Can use eslint-plugin-jsdoc

### Files to Create/Modify:

- `.husky/pre-commit`
- `.husky/commit-msg`
- `commitlint.config.js`
- Update `package.json` (lint-staged, scripts)

### Success Criteria:

- Pre-commit hooks installed
- Code formatting enforced (Prettier)
- Linting enforced (ESLint)
- Commit messages validated (conventional commits)
- Security checks in place
- Bypass documented

---

## Quick Start (Task 13.1)

```bash
# Create Phase13 branch from main
git checkout main
git pull origin main
git checkout -b Phase13

# Create task branch
git checkout -b task-13.1

# Create GitHub Actions directory
mkdir -p .github/workflows

# Create the CI workflow file
# (see Requirements above for content)

# Test workflow locally with act (optional)
# https://github.com/nektos/act
act -j test

# Commit and push
git add .github/
git commit -m "feat: add GitHub Actions CI workflow"
git push origin task-13.1

# Create PR and verify workflow runs
# Merge to Phase13 when complete
git checkout Phase13 && git merge --no-ff task-13.1
```

---

## Dependencies from Phase 12

Phase 13 integrates several components built in Phase 12:

| Phase 12 Component                    | Phase 13 Usage                                        |
| ------------------------------------- | ----------------------------------------------------- |
| Secret Encryption (`base/secrets.ts`) | CI/CD uses encrypted secrets for registry credentials |
| Security Scanning (Trivy)             | Integrated into CI pipeline security job              |
| RBAC (`base/rbac.ts`)                 | Can protect CI/CD endpoints and deployment triggers   |
| Security Hardening Guide              | Referenced in deployment security configuration       |

---

## Reference Files

- Task details: `/workspace/ActionPlan/Phase13/Task1/Task1.md`, `Task2/Task2.md`, `Task3/Task3.md`
- Checklist: `/workspace/ActionPlan/Phase13/TaskCheckList13.md`
- Phase 12 reference: `/workspace/ActionPlan/Phase12/TaskCheckList12.md`
- Secrets module: `base/secrets.ts`
- Existing templates: `base/templates/`

---

## Phase 13 Progress

1. **Task 13.1**: Create GitHub Actions Workflow ← START HERE
2. **Task 13.2**: Build Example CI Pipeline
3. **Task 13.3**: Create Pre-commit Hooks

---

## Notes

### Secrets to Configure in GitHub

For CI/CD to work, configure these secrets in GitHub repository settings:

| Secret Name       | Description                                                |
| ----------------- | ---------------------------------------------------------- |
| `DOCKER_USERNAME` | Docker Hub username                                        |
| `DOCKER_TOKEN`    | Docker Hub access token                                    |
| `CODECOV_TOKEN`   | Codecov upload token (optional, public repos work without) |

### Conventional Commit Types

For commitlint configuration:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Code style (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks
- `ci:` - CI/CD changes
- `build:` - Build system changes

### Multi-platform Build Notes

Docker buildx enables building for multiple architectures:

```yaml
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3

- name: Build and push
  uses: docker/build-push-action@v5
  with:
    platforms: linux/amd64,linux/arm64
    push: true
    tags: ${{ steps.meta.outputs.tags }}
```

This ensures the generator works on both Intel/AMD and Apple Silicon/ARM systems.

---

## Implementation Details

### Task 13.1: GitHub Actions Workflow Template

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
    tags: ["v*"]
  pull_request:
    branches: [main]
  workflow_dispatch:
    inputs:
      skip_tests:
        description: "Skip tests"
        required: false
        default: "false"

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run format check
        run: npm run format:check

      - name: Build
        run: npm run build

      - name: Run tests
        run: npm test
        if: inputs.skip_tests != 'true'

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build image
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: false
          tags: mcp-generator:test
          cache-from: type=gha
          cache-to: type=gha,mode=max

  security-scan:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build image for scanning
        run: docker build -t mcp-generator:scan .

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: "mcp-generator:scan"
          format: "sarif"
          output: "trivy-results.sarif"
          severity: "HIGH,CRITICAL"

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: "trivy-results.sarif"

  publish:
    if: startsWith(github.ref, 'refs/tags/v')
    needs: [test, build, security-scan]
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=semver,pattern={{major}}
            type=raw,value=latest

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}

  release:
    if: startsWith(github.ref, 'refs/tags/v')
    needs: publish
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Generate changelog
        id: changelog
        run: |
          echo "changelog<<EOF" >> $GITHUB_OUTPUT
          git log $(git describe --tags --abbrev=0 HEAD^)..HEAD --pretty=format:"- %s" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          body: ${{ steps.changelog.outputs.changelog }}
          generate_release_notes: true
```

### Task 13.3: Pre-commit Hooks Setup

**Step 1: Install Dependencies**

```bash
npm install --save-dev husky lint-staged @commitlint/cli @commitlint/config-conventional
```

**Step 2: Initialize Husky**

```bash
npx husky init
```

**Step 3: Create `.husky/pre-commit`**

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

**Step 4: Create `.husky/commit-msg`**

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx --no -- commitlint --edit ${1}
```

**Step 5: Create `commitlint.config.js`**

```javascript
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "test",
        "chore",
        "ci",
        "build",
        "perf",
      ],
    ],
    "subject-case": [2, "always", "lower-case"],
    "header-max-length": [2, "always", 72],
  },
};
```

**Step 6: Update `package.json`**

```json
{
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*.ts": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml}": ["prettier --write"]
  }
}
```

---

## Common Issues & Solutions

### Issue 1: Test Script is a Stub

**Problem**: `npm test` currently fails with placeholder error.

**Solutions**:

1. Wait for test framework from earlier phases
2. Temporarily change to: `"test": "npm run lint && npm run build"`
3. Add Jest/Vitest and create actual tests

### Issue 2: Docker Build Requires Pre-built `dist/`

**Problem**: Dockerfile expects `dist/` to exist from `npm run build`.

**Solution**: Add build step in CI before Docker build:

```yaml
- run: npm ci
- run: npm run build
- uses: docker/build-push-action@v5
```

Or modify Dockerfile to build inside container (larger image).

### Issue 3: GHCR Permissions

**Problem**: Publishing to GHCR requires correct permissions.

**Solution**: Add permissions block to job:

```yaml
permissions:
  contents: read
  packages: write
```

### Issue 4: Trivy Scan Finds Vulnerabilities

**Problem**: Base image (node:20-alpine) may have known vulnerabilities.

**Solutions**:

1. Use `.trivyignore` for accepted risks
2. Update base image regularly
3. Set `exit-code: 0` for non-blocking scans initially

---

## Estimated Effort

| Task      | Complexity  | Time Estimate  | Dependencies           |
| --------- | ----------- | -------------- | ---------------------- |
| 13.1      | Medium      | 3-4 hours      | Phase 12 complete      |
| 13.2      | Medium-High | 4-5 hours      | Task 13.1 for patterns |
| 13.3      | Low         | 1-2 hours      | None                   |
| **Total** |             | **8-11 hours** |                        |

---

## Post-Phase Checklist

After completing Phase 13:

- [ ] GitHub Actions workflow tested and passing
- [ ] Multi-platform Docker builds working (amd64, arm64)
- [ ] Security scanning integrated (Trivy)
- [ ] Version tagging automated (v1.2.3, v1.2, v1, latest)
- [ ] GitHub Releases created on tag push
- [ ] CI badges added to README
- [ ] Template CI pipeline in `templates/ci/`
- [ ] Pre-commit hooks installed and working
- [ ] Conventional commits enforced
- [ ] All documentation updated
- [ ] Required secrets documented

---

## README Badge Updates

Add these badges after CI is working:

```markdown
![CI](https://github.com/klogdog/EasyMCP/actions/workflows/ci.yml/badge.svg)
![Security Scan](https://github.com/klogdog/EasyMCP/actions/workflows/ci.yml/badge.svg?event=push)
[![codecov](https://codecov.io/gh/klogdog/EasyMCP/branch/main/graph/badge.svg)](https://codecov.io/gh/klogdog/EasyMCP)
```
