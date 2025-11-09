# Task 5.4: Build Entrypoint Script

**Goal**: Create shell script that runs before the server starts to validate environment.

**Actions**:

- Create `base/templates/entrypoint.sh.template` as bash script
- Add shebang: `#!/bin/bash` and `set -e` for exit on error
- Implement config file validation: check if MCP_CONFIG_PATH exists, validate YAML syntax with `yamllint` or Node script
- Add environment variable override: `export $(grep -v '^#' .env | xargs)` if .env file exists
- Check required variables: verify critical env vars are set (DATABASE_URL, etc), exit with error message if missing
- Implement startup logging: echo "Starting MCP Server...", log config location, list loaded tools/connectors
- Add process management: handle SIGTERM to gracefully stop server, forward signals to Node.js process
- Support different run modes: accept command line arg (dev/prod), adjust logging verbosity accordingly
- Execute main server: `exec node server.js "$@"` to replace shell process with Node

**Success Criteria**: Validates config before starting; sets up environment; logs startup info; handles signals properly
