# Task 8.4: Create Run Command

**Goal**: Build and immediately run the generated MCP server.

**Actions**:

- Add to `cli.ts`: `program.command('run').description('Build and start MCP server')`
- Add options: `--port <port>` (default 8080), `--host <host>` (default localhost), `--detach` (background mode), `--name <name>` (container name), `--env-file <path>` (load env vars)
- Implement build then run: call build command internally, on success start container
- Add port mapping configuration: map specified port to container's internal port, check if port already in use
- Implement volume mounting: mount config file, optionally mount tools/connectors for development hot-reload
- Include log streaming: attach to container logs, stream to console with timestamps, colors
- Add container lifecycle: on exit, optionally remove container (--rm flag), offer to restart on failure
- Implement health checking: wait for /health endpoint to return 200 before declaring success, timeout after 30s
- Support detached mode: in --detach, show container ID and how to view logs, how to stop

**Success Criteria**: Builds and runs server; maps ports correctly; streams logs; checks health; supports detached mode
