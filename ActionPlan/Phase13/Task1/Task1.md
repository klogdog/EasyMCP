# Task 13.1: Create GitHub Actions Workflow

**Goal**: Automate testing, building, and publishing of generator image.

**Actions**:

- Create `.github/workflows/ci.yml` with workflow triggers: push to main, pull requests, tags
- Add test job: checkout code, setup Node.js 20, npm install, npm test, upload coverage to Codecov
- Implement build job: build generator Docker image, use Docker buildx for multi-platform (amd64, arm64)
- Add security scanning job: scan image with Trivy, fail on HIGH/CRITICAL, upload results to GitHub Security tab
- Implement Docker publish: on tags (v\*), push to Docker Hub and GHCR, use secrets for credentials
- Add version tagging: extract version from git tag, tag image as `latest`, `v1.2.3`, `v1.2`, `v1`
- Include release automation: on tag push, create GitHub release with changelog, attach build artifacts
- Add workflow badges: display build status, coverage, security scan results in README
- Implement caching: cache npm dependencies, Docker layers for faster builds
- Add manual trigger: workflow_dispatch for manual runs with parameters
- Document CI/CD setup: required secrets (DOCKER_USERNAME, DOCKER_TOKEN), branch protection rules

**Success Criteria**: CI workflow runs on push/PR; tests pass; images built and published; releases automated; documented
