# Task 12.2: Add Security Scanning

**Goal**: Automated security vulnerability detection for containers and dependencies.

**Actions**:

- Integrate container scanning: add Trivy or Grype to scan generated Docker images for CVEs
- Add to build process: run `trivy image <image-name>` after build, fail if HIGH/CRITICAL vulnerabilities found
- Implement dependency scanning: use npm audit for Node.js, safety for Python, check for known vulnerabilities
- Add SAST (Static Analysis): integrate Semgrep or SonarQube to scan generated code for security issues
- Create security validation: check Dockerfile best practices (non-root user, no secrets in layers, minimal base image)
- Add automated reports: generate JSON/HTML security reports, include vulnerability details, remediation steps
- Implement CI integration: add security checks to GitHub Actions, block PRs with vulnerabilities
- Create allowlist: permit known false positives, document why they're acceptable
- Add update notifications: alert when new vulnerabilities discovered in used dependencies
- Document remediation: guide for addressing common vulnerabilities

**Success Criteria**: Container scanning works; dependency checks integrated; SAST functional; reports generated; CI integration complete
