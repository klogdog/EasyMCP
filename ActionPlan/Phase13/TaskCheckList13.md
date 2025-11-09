# Task Checklist for Phase 13: CI/CD & Automation

## Overview

This phase focuses on ci/cd & automation.

## Tasks

### Task 13.1: Create GitHub Actions Workflow

- [ ] Create `.github/workflows/ci.yml` with workflow triggers: push to main, pull requests, tags
- [ ] Add test job: checkout code, setup Node.js 20, npm install, npm test, upload coverage to Codecov
- [ ] Implement build job: build generator Docker image, use Docker buildx for multi-platform (amd64, arm64)
- [ ] Add security scanning job: scan image with Trivy, fail on HIGH/CRITICAL, upload results to GitHub Security tab
- [ ] Implement Docker publish: on tags (v\*), push to Docker Hub and GHCR, use secrets for credentials
- [ ] Add version tagging: extract version from git tag, tag image as `latest`, `v1.2.3`, `v1.2`, `v1`
- [ ] Include release automation: on tag push, create GitHub release with changelog, attach build artifacts
- [ ] Add workflow badges: display build status, coverage, security scan results in README
- [ ] Implement caching: cache npm dependencies, Docker layers for faster builds
- [ ] Add manual trigger: workflow_dispatch for manual runs with parameters
- [ ] Document CI/CD setup: required secrets (DOCKER_USERNAME, DOCKER_TOKEN), branch protection rules
- [ ] **Success Criteria**: CI workflow runs on push/PR; tests pass; images built and published; releases automated; documented


### Task 13.2: Build Example CI Pipeline

- [ ] Create `templates/ci/github-actions.yml.template` for generated server CI
- [ ] Add automated tool validation: on PR, run `mcp-gen validate` to check all tools/connectors are valid
- [ ] Implement integration testing: build test MCP server, start container, run test suite against it
- [ ] Include security scanning: scan generated server image, check dependencies for vulnerabilities
- [ ] Add deployment automation: on merge to main, build and push production image, deploy to staging environment
- [ ] Implement rollback procedures: if deployment fails health checks, automatically rollback to previous version
- [ ] Add smoke tests: post-deployment, call key MCP endpoints, verify responses
- [ ] Create deployment notifications: Slack/Discord webhook on successful/failed deployments
- [ ] Include environment promotion: manual approval workflow for promoting staging → production
- [ ] Add performance benchmarks: run load tests on generated server, compare to baseline, flag regressions
- [ ] Document pipeline customization: how to adapt template for specific deployment targets (K8s, ECS, Cloud Run)
- [ ] **Success Criteria**: Template CI pipeline complete; validates tools; runs integration tests; automates deployment; includes rollback; documented


### Task 13.3: Create Pre-commit Hooks

- [ ] Install husky and lint-staged: `npm install --save-dev husky lint-staged`
- [ ] Configure husky: run `npx husky init`, create pre-commit hook that runs lint-staged
- [ ] Set up lint-staged in package.json: run ESLint on \*.ts files, Prettier on all files, type checking
- [ ] Add code formatting checks: ensure all files formatted with Prettier, auto-fix if possible
- [ ] Implement linting: run ESLint with --max-warnings 0, enforce coding standards
- [ ] Add commit message validation: use commitlint, enforce conventional commits format (feat:, fix:, docs:)
- [ ] Include security checks: run npm audit, block commits if vulnerabilities found (configurable severity)
- [ ] Add test running: run affected tests for changed files (optional, can be slow)
- [ ] Create bypass option: allow `--no-verify` for emergencies, document when appropriate
- [ ] Add documentation checks: verify JSDoc comments present for public functions
- [ ] Document pre-commit setup: how to install hooks, what checks run, how to configure
- [ ] **Success Criteria**: Pre-commit hooks installed; format/lint checks run; commit messages validated; security checked; documented

