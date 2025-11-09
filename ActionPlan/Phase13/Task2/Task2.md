# Task 13.2: Build Example CI Pipeline

**Goal**: Provide template CI pipeline for generated MCP servers.

**Actions**:

- Create `templates/ci/github-actions.yml.template` for generated server CI
- Add automated tool validation: on PR, run `mcp-gen validate` to check all tools/connectors are valid
- Implement integration testing: build test MCP server, start container, run test suite against it
- Include security scanning: scan generated server image, check dependencies for vulnerabilities
- Add deployment automation: on merge to main, build and push production image, deploy to staging environment
- Implement rollback procedures: if deployment fails health checks, automatically rollback to previous version
- Add smoke tests: post-deployment, call key MCP endpoints, verify responses
- Create deployment notifications: Slack/Discord webhook on successful/failed deployments
- Include environment promotion: manual approval workflow for promoting staging → production
- Add performance benchmarks: run load tests on generated server, compare to baseline, flag regressions
- Document pipeline customization: how to adapt template for specific deployment targets (K8s, ECS, Cloud Run)

**Success Criteria**: Template CI pipeline complete; validates tools; runs integration tests; automates deployment; includes rollback; documented
