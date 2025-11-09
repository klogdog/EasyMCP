# Action Plan: MCP Server Generator - Docker-in-Docker Auto Builder

## Phase 1: Project Foundation & Structure

### Task 1.1: Initialize Project Structure

**Goal**: Set up the foundational directory structure for the MCP server generator project.

**Actions**:

- Create directories: `/base` (generator code), `/tools` (drop-in MCP tools), `/connectors` (API integrations), `/config` (runtime configs), `/templates` (code generation templates)
- Add README.md in each directory: explain purpose, expected file formats, and naming conventions
- Create `.gitignore`: exclude `node_modules/`, `dist/`, `*.log`, `.env`, `*.img`, Docker build artifacts

**Success Criteria**: All directories exist with descriptive READMEs; git ignores build artifacts

### Task 1.2: Configure Package Management

**Goal**: Set up Node.js/TypeScript project configuration with all necessary dependencies.

**Actions**:

- Create `package.json`: name="mcp-generator", version="0.1.0", main="dist/main.js", scripts for build/test
- Add dependencies: `typescript`, `@types/node`, `dockerode` (Docker SDK), `inquirer` (interactive prompts), `js-yaml` (YAML parsing), `zod` (schema validation)
- Add devDependencies: `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `prettier`, `@types/inquirer`, `@types/js-yaml`
- Create `tsconfig.json`: target ES2020, module commonjs, outDir "./dist", strict mode enabled, esModuleInterop true

**Success Criteria**: `npm install` runs successfully; TypeScript compiles without errors

### Task 1.3: Set Up Development Container

**Goal**: Create VS Code devcontainer for Docker-in-Docker development environment.

**Actions**:

- Create `.devcontainer/devcontainer.json`
- Set `image: "mcr.microsoft.com/devcontainers/typescript-node:20"` or similar
- Add features: `"ghcr.io/devcontainers/features/docker-in-docker:2"` for DinD capability
- Configure mounts: bind `/tools`, `/connectors`, `/config` to container
- Set `remoteEnv` for forwarding HOST_PROJECT_PATH, DOCKER_HOST
- Add `postCreateCommand: "npm install"` for automatic setup
- Configure VS Code extensions: Docker, ESLint, Prettier

**Success Criteria**: Opening in VS Code starts container; `docker ps` works inside container; npm packages installed

### Task 1.4: Create Base Dockerfile

**Goal**: Build the Dockerfile for the MCP generator container that will build other MCP servers.

**Actions**:

- Create `Dockerfile` with base `FROM node:20-alpine`
- Install Docker CLI: `apk add docker-cli` (for DinD operations)
- Create WORKDIR `/app`
- Copy `package*.json` and run `npm ci --only=production`
- Copy source files from `/base` directory
- Create volume mount points: `/app/tools`, `/app/connectors`, `/app/config`
- Set ENV NODE_ENV=production
- Define ENTRYPOINT `["node", "dist/main.js"]` with default CMD `["build"]`

**Success Criteria**: `docker build -t mcp-generator .` succeeds; image contains Node.js, Docker CLI, and source code

## Phase 2: Core Generator Components

### Task 2.1: Implement Module Loader

**Goal**: Create a module discovery system that finds and loads all tools and connectors from their directories.

**Actions**:

- Create `base/loader.ts` with main export `async function loadModules(basePath: string): Promise<Module[]>`
- Use `fs.promises.readdir` with recursive option to scan `/tools` and `/connectors`
- Filter files matching `*.ts` and `*.py` extensions using path.extname()
- For each file, extract metadata by parsing JSDoc/docstring comments or looking for export const metadata = {...}
- Return array of Module objects: `{ name: string, path: string, type: 'tool'|'connector', language: 'typescript'|'python', metadata: {...} }`
- Add try-catch error handling for each file; log warnings for malformed modules but continue
- Export types: `interface Module`, `interface ToolMetadata`, `interface ConnectorMetadata`

**Success Criteria**: Function returns all valid modules; handles missing metadata gracefully; logs clear error messages

### Task 2.2: Build Module Validator

**Goal**: Validate loaded modules against MCP schema and check for conflicts.

**Actions**:

- Create `base/validator.ts` with `function validateModules(modules: Module[]): ValidationResult`
- Define Zod schemas for MCP tool spec: must have name, description, inputSchema (JSON Schema), handler function
- Define Zod schemas for connector spec: must have name, type, authentication config, methods
- Check for duplicate names across modules (return error if conflicts found)
- Validate dependencies: ensure referenced npm packages are installable, check version compatibility
- Implement schema versioning: check `metadata.schemaVersion` field, support v1.0 initially
- Return `{ valid: boolean, errors: ValidationError[], warnings: string[] }`

**Success Criteria**: Rejects invalid modules; identifies naming conflicts; accepts valid MCP tool/connector schemas

### Task 2.3: Create Manifest Generator

**Goal**: Merge all validated modules into a single MCP server manifest.

**Actions**:

- Create `base/generator.ts` with `async function generateManifest(modules: Module[]): Promise<MCPManifest>`
- Create MCPManifest structure: `{ name: string, version: string, tools: Tool[], connectors: Connector[], capabilities: string[], dependencies: Record<string, string> }`
- Merge all tool modules: collect tool definitions, combine input schemas, aggregate capabilities
- Merge all connector modules: collect connector configs, merge authentication requirements
- Generate server metadata: version from git tag or package.json, timestamp, generator version
- Consolidate dependencies: merge package.json dependencies from all modules, resolve version conflicts (use highest semver)
- Add capabilities array: list unique capabilities like "text-processing", "email-integration", etc.
- Validate final manifest against MCP protocol specification

**Success Criteria**: Produces valid MCP manifest JSON; all tools/connectors included; dependencies resolved

### Task 2.4: Build Configuration Generator

**Goal**: Generate runtime configuration file template for the MCP server.

**Actions**:

- Create `base/config-generator.ts` with `async function generateConfig(manifest: MCPManifest, secrets: Record<string, string>): Promise<string>`
- Define config schema: database (url, pool settings), services (API keys by service name), logging (level, format), features (flags), server (port, host)
- Create YAML template using js-yaml library: iterate through manifest connectors, add placeholder for each required credential
- Insert environment variable references: use `${VAR_NAME}` syntax for secrets, `${PORT:-8080}` for defaults
- Add inline comments explaining each section and how to override via env vars
- Generate different variants: development (verbose logging, localhost), production (structured logs, external DB)
- Return formatted YAML string
- Include validation function: `validateConfig(configString: string): boolean`

**Success Criteria**: Generates valid YAML; includes all connector credentials; supports env var substitution

## Phase 3: User Interaction & Secrets

### Task 3.1: Create Interactive Prompt System

**Goal**: Build user-friendly CLI prompts for collecting credentials and configuration.

**Actions**:

- Create `base/prompt.ts` using inquirer library
- Export `async function promptForCredentials(requirements: CredentialRequirement[]): Promise<Record<string, string>>`
- For each requirement, create appropriate prompt type: input (text), password (masked), confirm (yes/no), list (dropdown)
- Add validation callbacks: email format, URL format, non-empty strings, numeric ranges
- Implement conditional prompts: only ask for OAuth tokens if user selects OAuth authentication method
- Add confirmation step: display all collected values (mask secrets) and ask "Proceed with these settings?"
- Support defaults from environment variables: check process.env first, use as default value if present
- Handle Ctrl+C gracefully: clean exit with message

**Success Criteria**: Prompts are user-friendly; passwords are masked; validates input format; supports defaults

### Task 3.2: Build Secret Manager

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

### Task 3.3: Create Credential Schema Discovery

**Goal**: Automatically detect what credentials each module needs.

**Actions**:

- Extend `loader.ts` to parse credential requirements from module metadata
- Look for `metadata.credentials` field in each module: `[{ name: string, type: 'api_key'|'oauth'|'password', required: boolean, description: string }]`
- Parse TypeScript JSDoc comments: extract `@requires-credential` tags
- For Python files, parse docstrings looking for `:credential` directives
- Aggregate all requirements across modules: merge duplicates (e.g., multiple tools need same API key)
- Build CredentialRequirement array with metadata: service name, whether it's optional, validation rules
- Handle optional credentials: mark clearly in prompts, allow skipping
- Create type definitions: `interface CredentialRequirement { name: string, type: CredentialType, required: boolean, description: string, validation?: RegExp }`

**Success Criteria**: Automatically discovers all credential needs; merges duplicates; distinguishes required vs optional

## Phase 4: Docker Integration

### Task 4.1: Implement Docker Client Wrapper

**Goal**: Create abstraction layer for Docker operations using dockerode.

**Actions**:

- Create `base/docker-client.ts` with class DockerClient
- Initialize dockerode: `new Docker({ socketPath: '/var/run/docker.sock' })` or from DOCKER_HOST env
- Implement `async ping(): Promise<boolean>` to verify Docker daemon connectivity
- Add `async buildImage(context: string, dockerfile: string, tag: string, onProgress?: (msg) => void): Promise<string>`
- Implement `async listImages(filter?: string): Promise<ImageInfo[]>` to query local images
- Add `async removeImage(imageId: string): Promise<void>` for cleanup
- Implement `async createContainer(config: ContainerConfig): Promise<Container>` and `startContainer(id: string)`
- Add error handling: wrap Docker errors with descriptive messages, detect "daemon not running" errors
- Implement streaming: use dockerode streams API for build progress, parse JSON progress messages

**Success Criteria**: Connects to Docker; builds images successfully; streams progress; handles errors gracefully

### Task 4.2: Build Dockerfile Generator

**Goal**: Dynamically generate Dockerfile for the MCP server based on loaded modules.

**Actions**:

- Create `base/dockerizer.ts` with `async function generateDockerfile(manifest: MCPManifest, config: string): Promise<string>`
- Start with base image selection: use `node:20-alpine` if only TypeScript tools, `python:3.11-slim` if Python modules, multi-stage build if both
- Add runtime dependencies: install npm packages from manifest.dependencies, Python packages from requirements
- Generate COPY instructions: copy all tool files from /tools, connector files from /connectors, generated manifest
- Add config setup: `COPY config.yaml /app/config/config.yaml`, make it overridable via volume mount
- Create working directory structure: `/app`, `/app/tools`, `/app/connectors`, `/app/config`
- Set environment variables: NODE_ENV=production, MCP_CONFIG_PATH=/app/config/config.yaml
- Define ENTRYPOINT and CMD: `ENTRYPOINT ["node", "server.js"]` with health check
- Add metadata labels: version, build date, tool list
- Return complete Dockerfile as string

**Success Criteria**: Generates valid Dockerfile; includes all dependencies; supports both Node and Python

### Task 4.3: Create Image Builder

**Goal**: Execute Docker image builds with the generated Dockerfile and build context.

**Actions**:

- Extend `dockerizer.ts` with `async function buildMCPImage(manifest: MCPManifest, config: string, options: BuildOptions): Promise<string>`
- Create build context directory: temp folder with Dockerfile, all tools/connectors, config file, manifest.json
- Use `tar` library to create build context tarball (Docker API requires tar stream)
- Call DockerClient.buildImage() with context stream and generated Dockerfile
- Stream build progress to console: parse JSON progress messages, show step numbers, time elapsed
- Capture build logs: store in .build.log for debugging, include timestamps
- Handle build failures: parse error messages, identify which step failed, suggest fixes (missing dependency, syntax error)
- Add rollback capability: if build fails, don't tag image, clean up partial images
- Return imageId on success

**Success Criteria**: Successfully builds images; shows real-time progress; captures logs; handles failures gracefully

### Task 4.4: Implement Image Tagging & Registry

**Goal**: Tag built images with meaningful names and optionally push to registry.

**Actions**:

- Create `base/registry.ts` with `async function tagImage(imageId: string, tags: string[]): Promise<void>`
- Implement tagging strategy: use `mcp-server:latest`, `mcp-server:v{version}`, `mcp-server:{timestamp}`
- Add `async function pushImage(tag: string, registry: string, auth?: RegistryAuth): Promise<void>` using dockerode
- Implement registry authentication: support Docker Hub, GitHub Container Registry, private registries via auth config
- Create `async function listLocalImages(prefix: string): Promise<ImageInfo[]>` to show available MCP images
- Add cleanup utility: `async function pruneOldImages(keepCount: number): Promise<void>` to remove old builds
- Implement tag validation: ensure tags follow Docker naming conventions, handle special characters
- Add dry-run mode for push operations

**Success Criteria**: Tags images with version/timestamp; can push to registry; cleans up old images

## Phase 5: MCP Server Templates

### Task 5.1: Create Base Server Template

**Goal**: Create template for the main MCP server entry point that will be generated.

**Actions**:

- Create `base/templates/server.ts.template` as a string template with placeholders
- Implement MCP protocol handler: HTTP server listening on port from config, JSON-RPC 2.0 endpoint `/mcp`
- Add config loading: `const config = yaml.load(fs.readFileSync(process.env.MCP_CONFIG_PATH))`, validate structure
- Initialize logging: use winston or pino, configure level/format from config, add request ID tracking
- Implement graceful shutdown: listen for SIGTERM/SIGINT, close connections, flush logs, exit cleanly
- Add health endpoint: `/health` returns 200 with { status: 'ok', tools: [...], connectors: [...] }
- Include error middleware: catch unhandled errors, log with context, return proper JSON-RPC error responses
- Add placeholder markers: `{{TOOL_IMPORTS}}`, `{{CONNECTOR_IMPORTS}}`, `{{TOOL_REGISTRATION}}` for code generation

**Success Criteria**: Template compiles to valid TypeScript; supports config loading; has health checks; handles shutdown

### Task 5.2: Build Tool Integration Template

**Goal**: Template for dynamically loading and registering MCP tools at runtime.

**Actions**:

- Create `base/templates/tool-loader.ts.template`
- Implement `class ToolRegistry { private tools = new Map<string, Tool>(); register(tool: Tool); get(name: string); list(); }`
- Add dynamic import logic: iterate through manifest.tools, `await import(toolPath)`, extract default export
- Create tool invocation router: `async function invokeTool(name: string, args: any): Promise<any>` that looks up tool and calls its handler
- Implement error handling wrapper: try-catch around each tool invocation, log errors, return structured error response
- Add tool lifecycle: `onLoad()` hook when tool is registered, `onUnload()` for cleanup
- Implement input validation: validate args against tool.inputSchema using JSON Schema validator (ajv)
- Add result transformation: wrap tool output in standard format `{ success: boolean, result?: any, error?: string }`
- Include placeholder: `{{TOOL_LIST}}` for injecting tool definitions during code generation

**Success Criteria**: Dynamically loads tools; validates inputs; handles errors; provides consistent response format

### Task 5.3: Create Connector Integration Template

**Goal**: Template for initializing external service connectors with credentials from config.

**Actions**:

- Create `base/templates/connector-loader.ts.template`
- Implement `class ConnectorRegistry` similar to ToolRegistry but with connection management
- Add connector initialization: `async function initializeConnector(config: ConnectorConfig): Promise<Connector>` that reads credentials from config, creates client instance
- Implement credential injection: read from config.services[connectorName], support OAuth, API keys, basic auth
- Add connection pooling: maintain pool of active connections, reuse for multiple requests, handle connection timeouts
- Create health check system: `async function checkConnectorHealth(name: string): Promise<boolean>` that pings each service
- Implement retry logic: exponential backoff for failed connections, configurable max retries
- Add connection lifecycle: `connect()`, `disconnect()`, `reconnect()` methods
- Include graceful degradation: if connector fails to initialize, log warning but continue (unless marked as required)

**Success Criteria**: Initializes connectors with credentials; manages connection pools; has health checks; handles failures

### Task 5.4: Build Entrypoint Script

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

## Phase 6: Example Tools & Connectors

### Task 6.1: Create Example Tool - Summarize

**Goal**: Build reference implementation of an MCP tool for text summarization.

**Actions**:

- Create `tools/summarize.ts` with proper MCP tool structure
- Export metadata: `export const metadata = { name: 'summarize', description: 'Summarize text to specified length', schemaVersion: '1.0' }`
- Define input schema: `{ text: string (required), maxLength?: number (default 100), style?: 'bullet'|'paragraph' }`
- Implement handler function: `export async function summarize(input: SummarizeInput): Promise<string>`
- Add basic algorithm: split into sentences, extract key sentences, join up to maxLength
- Include input validation: check text is non-empty, maxLength is positive number
- Add JSDoc comments: `@tool`, `@param`, `@returns`, `@example`
- Export default: `export default { metadata, handler: summarize }`

**Success Criteria**: Tool is discovered by loader; validates inputs; produces summaries; has clear documentation

### Task 6.2: Create Example Tool - Translate

**Goal**: Build MCP tool demonstrating external API integration (translation service).

**Actions**:

- Create `tools/translate.ts` following MCP tool pattern
- Export metadata with credentials requirement: `credentials: [{ name: 'TRANSLATION_API_KEY', type: 'api_key', required: false }]`
- Define input schema: `{ text: string, targetLanguage: string, sourceLanguage?: string }`
- Implement handler: if API key present, call external API (e.g., Google Translate), else use simple mock/fallback
- Add language detection: auto-detect source language using language detection library
- Include API key from config: `const apiKey = config.services.translation`
- Add error handling: catch API errors, return user-friendly messages
- Include example usage in JSDoc with different language pairs

**Success Criteria**: Tool declares credential requirement; works with/without API key; handles errors; detects language

### Task 6.3: Create Example Tool - Classify

**Goal**: Build MCP tool for text classification demonstrating configurable categories.

**Actions**:

- Create `tools/classify.ts` with MCP tool structure
- Export metadata with configuration: `config: { categories: string[], confidenceThreshold: number }`
- Define input schema: `{ text: string, categories?: string[] }` (override default categories)
- Implement simple classification: keyword matching, regex patterns, or basic sentiment analysis
- Add confidence scoring: return score 0-1 for each category
- Format results: `{ category: string, confidence: number, matches: string[] }[]` sorted by confidence
- Read categories from config: support both tool-level and runtime config
- Include examples of different use cases: sentiment, topic classification, intent detection

**Success Criteria**: Classifies text into categories; returns confidence scores; supports custom categories; configurable

### Task 6.4: Create Example Connector - Gmail

**Goal**: Build connector demonstrating OAuth2 authentication and email operations.

**Actions**:

- Create `connectors/gmail.ts` following connector pattern
- Export metadata: `{ name: 'gmail', type: 'email', authentication: { type: 'oauth2', scopes: ['gmail.readonly', 'gmail.send'] } }`
- Declare credentials: `credentials: [{ name: 'GMAIL_CLIENT_ID', required: true }, { name: 'GMAIL_CLIENT_SECRET', required: true }, { name: 'GMAIL_REFRESH_TOKEN', required: true }]`
- Implement initialization: create Gmail API client using googleapis npm package, set up OAuth2 client
- Add basic operations: `async listMessages(maxResults: number)`, `async sendEmail(to, subject, body)`, `async searchMessages(query)`
- Implement rate limiting: track requests per minute, delay if exceeding quota, respect API limits
- Add connection test: `async testConnection(): Promise<boolean>` that verifies credentials
- Include error handling: handle token expiration, quota exceeded, network errors

**Success Criteria**: Connects to Gmail API; performs email operations; handles OAuth2; respects rate limits

### Task 6.5: Create Example Connector - Notion

**Goal**: Build connector for Notion API demonstrating database operations.

**Actions**:

- Create `connectors/notion.ts` with connector structure
- Export metadata: `{ name: 'notion', type: 'database', authentication: { type: 'token' } }`
- Declare credentials: `credentials: [{ name: 'NOTION_TOKEN', type: 'api_key', required: true }]`
- Implement initialization: create Notion client using @notionhq/client, authenticate with integration token
- Add database operations: `async queryDatabase(databaseId, filter?)`, `async createPage(databaseId, properties)`, `async updatePage(pageId, properties)`, `async getPage(pageId)`
- Implement error handling: handle invalid database IDs, permission errors, network issues
- Add retry logic: Notion has rate limits, implement exponential backoff
- Include helper methods: `async listDatabases()` to discover available databases

**Success Criteria**: Connects to Notion; queries databases; creates/updates pages; handles authentication; respects rate limits

## Phase 7: Configuration Management

### Task 7.1: Create Config Schema Definition

**Goal**: Define formal schema for MCP server configuration file.

**Actions**:

- Create `config/schema.yaml` with complete config structure documentation
- Define database section: `database: { type: 'postgres'|'sqlite'|'mysql', url: string, pool: { min: number, max: number, idleTimeout: number } }`
- Define services section: `services: { [serviceName: string]: { apiKey?: string, endpoint?: string, timeout?: number } }`
- Add logging section: `logging: { level: 'debug'|'info'|'warn'|'error', format: 'json'|'text', destination: 'stdout'|'file', filePath?: string }`
- Include feature flags: `features: { [featureName: string]: boolean }` for toggling functionality
- Add server section: `server: { port: number, host: string, cors: boolean, maxRequestSize: string }`
- Include JSON Schema version of same structure in `config/schema.json` for validation
- Add examples for each field with comments

**Success Criteria**: Complete schema covering all config options; both YAML and JSON Schema versions; well-documented

### Task 7.2: Build Config Parser

**Goal**: Create robust configuration file parser with environment variable substitution.

**Actions**:

- Create `base/config-parser.ts` with `async function parseConfig(filePath: string): Promise<Config>`
- Implement YAML parsing: use js-yaml, handle syntax errors gracefully with line numbers
- Add JSON support as fallback: try parsing as JSON if YAML fails
- Implement env var substitution: replace `${VAR_NAME}` with `process.env.VAR_NAME`, support defaults `${VAR:-default}`
- Add recursive substitution: handle nested objects, arrays
- Implement default values: merge with defaults from schema, only override what's specified
- Add validation: use Zod schema based on config/schema.json, return detailed error messages with field paths
- Include type generation: export TypeScript types matching config structure
- Handle missing files: return sensible defaults or throw descriptive error based on strict mode

**Success Criteria**: Parses YAML/JSON; substitutes env vars with defaults; validates against schema; handles errors clearly

### Task 7.3: Create Config Override System

**Goal**: Support multiple config sources with proper precedence.

**Actions**:

- Extend `config-parser.ts` with `function mergeConfigs(base: Config, ...overrides: Partial<Config>[]): Config`
- Implement CLI argument parsing: accept `--config.server.port=3000` style args, parse into nested object
- Add environment-specific configs: load `config.{env}.yaml` based on NODE_ENV, merge with base config
- Implement merge strategy: deep merge for objects, replace for primitives, concat for arrays (configurable)
- Add precedence order: defaults < config file < env-specific file < environment variables < CLI args
- Create debugging utility: `--debug-config` flag that prints final merged config with source annotations
- Implement config watching: optionally reload config on file change (for development)
- Add validation after merge: ensure final config still passes schema validation

**Success Criteria**: Merges multiple config sources; respects precedence; supports env-specific files; has debug mode

### Task 7.4: Build Default Config Template

**Goal**: Create well-documented config template with sensible defaults.

**Actions**:

- Create `config/config.yaml.template` with all sections and inline comments
- Add sensible defaults: port 8080, log level info, SQLite database for dev, connection pool min=2 max=10
- Include inline documentation: comment above each field explaining purpose, valid values, examples
- Add placeholder values for secrets: use `${API_KEY}` syntax, note which are required vs optional
- Create dev variant `config.dev.yaml`: verbose logging, localhost bindings, permissive CORS, SQLite
- Create production variant `config.prod.yaml`: structured JSON logs, external DB required, strict security
- Add security notes: comments warning about sensitive values, recommend using env vars not hardcoding
- Include example overrides: show how to override via environment variables

**Success Criteria**: Complete template with all options; clear documentation; separate dev/prod variants; security guidance

## Phase 8: CLI & Main Entry Point

### Task 8.1: Create CLI Interface

**Goal**: Build user-friendly command-line interface for the generator.

**Actions**:

- Create `base/cli.ts` using commander.js: `const program = new Command()`
- Add version flag: `-v, --version` reads from package.json
- Add help documentation: `-h, --help` with examples and common usage patterns
- Implement verbosity control: `-q` (quiet), default, `-v` (verbose), `-vv` (debug)
- Add commands: `build` (generate MCP server), `run` (build and start), `list-tools` (show discovered modules), `validate` (check modules)
- Include global options: `--config <path>`, `--tools-dir <path>`, `--connectors-dir <path>`, `--no-cache`
- Add colorized output: use chalk for success (green), errors (red), warnings (yellow), info (blue)
- Implement command aliases: `b` for build, `r` for run

**Success Criteria**: User-friendly CLI; clear help text; colorized output; supports common patterns; good error messages

### Task 8.2: Build Main Orchestrator

**Goal**: Coordinate all generator steps in proper sequence.

**Actions**:

- Create `base/main.ts` with `async function generateMCPServer(options: GeneratorOptions): Promise<BuildResult>`
- Implement workflow orchestration: 1) Load modules 2) Validate 3) Prompt for credentials 4) Generate manifest 5) Generate config 6) Build Docker image 7) Tag and optionally push
- Add step-by-step logging: "Step 1/7: Loading modules...", show progress, time per step
- Implement error recovery: if step fails, log context, offer suggestions, allow retry or skip (if non-critical)
- Add dry-run mode: `--dry-run` flag executes all steps except Docker build, shows what would be created
- Include checkpointing: save intermediate results (manifest.json, config.yaml) even if later steps fail
- Add resume capability: detect partial builds, offer to continue from last successful step
- Implement rollback: if build fails, clean up temp files, partial images, restore previous state

**Success Criteria**: Coordinates all steps; shows clear progress; handles errors gracefully; supports dry-run; can resume

### Task 8.3: Create Build Command

**Goal**: Implement the main 'build' command for generating MCP servers.

**Actions**:

- Add to `cli.ts`: `program.command('build').description('Build MCP server image from tools and connectors')`
- Add options: `--output <name>` (image name), `--tag <tag>` (version tag), `--platform <platforms>` (multi-arch), `--no-cache` (force rebuild), `--push` (push to registry)
- Implement source validation: check tools/ and connectors/ directories exist, contain valid files, warn if empty
- Add build options processing: parse platform string (linux/amd64,linux/arm64), validate image name format
- Include progress indicators: use ora spinner or progress bar, show current step, estimated time remaining
- Implement build summary: on completion, show image ID, size, tag, list included tools/connectors, build duration
- Add output options: `--quiet` for minimal output, `--json` for machine-readable output
- Handle interruption: Ctrl+C during build cleans up gracefully, doesn't leave partial images

**Success Criteria**: Builds MCP server images; validates sources; shows progress; produces detailed summary; handles interruption

### Task 8.4: Create Run Command

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

## Phase 9: Testing & Quality

### Task 9.1: Set Up Testing Framework

**Goal**: Configure Jest testing framework with TypeScript support.

**Actions**:

- Run `npm install --save-dev jest @types/jest ts-jest @jest/globals`
- Create `jest.config.js`: preset "ts-jest", testEnvironment "node", roots ["<rootDir>/base"], coverage enabled
- Add test scripts to package.json: `"test": "jest"`, `"test:watch": "jest --watch"`, `"test:coverage": "jest --coverage"`
- Set up coverage reporting: coverageDirectory "./coverage", coverageThreshold 80%, reporters text and lcov
- Create test utilities in `base/__tests__/utils/`: mock Docker client, mock file system, test fixtures
- Add test fixtures directory: sample tools, connectors, configs for testing
- Configure CI-friendly output: `--ci` flag for test script in CI environments

**Success Criteria**: Jest configured; can run tests with `npm test`; coverage reports generated; test utilities available

### Task 9.2: Write Unit Tests - Loader

**Goal**: Test module loading and discovery functionality.

**Actions**:

- Create `base/__tests__/loader.test.ts`
- Test module discovery: mock fs with sample tools, verify loadModules finds all .ts/.py files
- Test file filtering: verify non-matching extensions ignored, hidden files skipped
- Test metadata extraction: verify name, description, dependencies correctly parsed from different formats
- Test error handling: malformed metadata, missing files, unreadable files - should log warning and continue
- Test edge cases: empty directories, symlinks, nested directories, very long paths
- Mock file system: use memfs or mock fs.promises for fast, isolated tests
- Aim for >90% coverage of loader.ts

**Success Criteria**: Comprehensive test coverage; tests pass; edge cases covered; runs fast (<1s)

### Task 9.3: Write Unit Tests - Generator

**Goal**: Test manifest generation and tool/connector merging.

**Actions**:

- Create `base/__tests__/generator.test.ts`
- Test manifest generation: provide array of modules, verify output manifest has correct structure
- Test tool merging: multiple tools with different capabilities, verify all included, no duplicates
- Test conflict detection: tools with same name, verify error thrown with clear message
- Test validation rules: invalid tool schema, missing required fields, verify rejected with reason
- Test schema versioning: different schema versions, verify handled correctly or error if unsupported
- Mock validator and loader dependencies
- Verify capabilities aggregation: ensure unique capabilities listed
- Test dependency resolution: conflicting versions, verify highest compatible chosen

**Success Criteria**: All generator logic tested; >85% coverage; validates error cases; fast execution

### Task 9.4: Write Unit Tests - Config

**Goal**: Test configuration parsing, validation, and merging.

**Actions**:

- Create `base/__tests__/config-parser.test.ts`
- Test config generation: given manifest and secrets, verify valid YAML produced
- Test variable substitution: ${VAR}, ${VAR:-default}, nested vars, verify all replaced correctly
- Test schema validation: valid config passes, invalid configs rejected with field-level errors
- Test override merging: base + overrides, verify correct precedence, deep merge behavior
- Test parsing errors: invalid YAML syntax, verify error has line number and helpful message
- Mock environment variables using process.env manipulation
- Test default values: missing optional fields get defaults from schema
- Test circular references: ensure doesn't cause infinite loops

**Success Criteria**: Config parser thoroughly tested; >90% coverage; validates all merge scenarios; clear error messages

### Task 9.5: Write Integration Tests

**Goal**: Test complete workflows from module loading to Docker image creation.

**Actions**:

- Create `base/__tests__/integration/` directory for integration tests
- Test end-to-end build: real tools/connectors dirs, run full generator, verify image created (use testcontainers or actual Docker)
- Test Docker image creation: verify generated Dockerfile valid, builds successfully, contains expected files
- Test generated server startup: start container, verify listens on port, /health returns 200
- Test tool invocation: make MCP protocol request to generated server, verify tool executes and returns result
- Test connector integration: if connector requires external service, mock with nock or use test credentials
- Use temporary directories: create fresh test workspace for each test, cleanup after
- Add longer timeout: integration tests may take 30-60s, configure Jest timeout
- Tag tests: use describe.skip or test.only for conditional execution

**Success Criteria**: End-to-end workflows tested; real Docker operations; verifies generated server works; isolated tests

### Task 9.6: Create Example End-to-End Test

**Goal**: Build complete example test demonstrating full MCP server lifecycle.

**Actions**:

- Create `base/__tests__/integration/e2e-example.test.ts` with detailed comments
- Set up test workspace: create temp dir, copy example tools (summarize, translate), example connector (notion-mock)
- Build MCP server: run generator programmatically, capture manifest, config, image ID
- Launch container: start generated server, wait for health check, map to random port
- Execute tool via MCP: send JSON-RPC request to summarize tool, verify response format and result
- Test connector (mocked): verify connector initialized, mock external API call, verify success
- Validate configuration: verify config file used, environment variables respected
- Cleanup: stop and remove container, remove image, delete temp workspace
- Add assertions at each step: verify intermediate outputs, check error conditions
- Document expected behavior: comments explaining what each step validates

**Success Criteria**: Complete example test; well-documented; demonstrates best practices; serves as template for custom tests

## Phase 10: Documentation & Examples

### Task 10.1: Write Tool Development Guide

**Goal**: Create comprehensive guide for developing custom MCP tools.

**Actions**:

- Create `docs/tool-development.md` with table of contents
- Document tool structure requirements: file location (/tools), naming conventions, required exports (metadata, handler)
- Add metadata specification: all fields (name, description, inputSchema, outputSchema, schemaVersion, credentials, config)
- Provide complete example: step-by-step creation of a new tool (e.g., spell-checker), with code and explanations
- Include input validation: how to use JSON Schema, common patterns, error handling
- Add best practices: async/await patterns, error messages, logging, testing, documentation
- Document credential requirements: how to declare needed API keys, how to access from config
- Include examples: simple tool (no deps), API-dependent tool, stateful tool, multi-step tool
- Add troubleshooting section: common errors and solutions

**Success Criteria**: Complete guide; clear examples; follows best practices; enables developers to create tools independently

### Task 10.2: Write Connector Development Guide

**Goal**: Document how to create connectors for external services.

**Actions**:

- Create `docs/connector-development.md` with structured sections
- Document connector interface: required methods (initialize, connect, disconnect, health check), lifecycle
- Add authentication patterns: API keys, OAuth2, basic auth, custom - with code examples for each
- Include connection management: pooling, retry logic, timeout handling, reconnection strategies
- Provide complete example: build Slack connector from scratch with full code
- Add error handling examples: network errors, authentication failures, rate limits, API errors
- Document credential declaration: how to specify required credentials in metadata
- Include testing guidance: how to mock external services, test connectors in isolation
- Add security considerations: secure credential storage, HTTPS requirements, token refresh

**Success Criteria**: Complete connector guide; covers authentication types; includes working examples; security-conscious

### Task 10.3: Create Configuration Guide

**Goal**: Comprehensive documentation of configuration system.

**Actions**:

- Create `docs/configuration.md` covering all config options
- Document all sections: database, services, logging, features, server - with every field explained
- Add environment variable reference: table of all supported env vars, defaults, examples
- Include override examples: show precedence, CLI args, env-specific files, merging behavior
- Provide configuration recipes: common scenarios (dev setup, prod deployment, multi-service)
- Add troubleshooting section: config validation errors, env var not substituted, secrets issues
- Document security best practices: never commit secrets, use env vars, encrypt at rest, rotate credentials
- Include validation: how to validate config before deploying, using --dry-run
- Add migration guide: if config schema changes between versions

**Success Criteria**: Every config option documented; clear examples; security guidance; troubleshooting help

### Task 10.4: Write Deployment Guide

**Goal**: Document deployment options and production considerations.

**Actions**:

- Create `docs/deployment.md` with deployment patterns
- Document Docker deployment: docker run commands, docker-compose example, environment setup
- Add Kubernetes examples: Deployment, Service, ConfigMap, Secret manifests with annotations
- Include registry setup: how to push to Docker Hub, GHCR, private registry, authentication
- Add production considerations: resource limits, health checks, logging, monitoring, scaling
- Document environment variables: how to inject secrets, use Kubernetes secrets, AWS Parameter Store
- Include networking: reverse proxy setup (nginx, Traefik), SSL/TLS termination, load balancing
- Add high availability: multi-replica deployment, rolling updates, zero-downtime deploys
- Include monitoring setup: Prometheus metrics, log aggregation, alerting
- Add backup/restore procedures for configurations and data

**Success Criteria**: Multiple deployment options documented; production-ready examples; scalability guidance; security best practices

### Task 10.5: Create Quick Start Guide

**Goal**: Update main README with getting started instructions.

**Actions**:

- Update `README.md` with Quick Start section at top
- Add installation instructions: prerequisites (Docker, Node.js), clone repo, npm install, build generator image
- Include "first build" walkthrough: create simple tool, run generator, see it work - with actual commands and expected output
- Add common usage examples: build with custom tools, run server locally, test with curl/MCP client
- Include troubleshooting FAQ: Docker not running, permission errors, port conflicts, module not found
- Add "What's Next" section: links to detailed guides, how to add connectors, deployment options
- Include architecture diagram: visual showing generator → modules → Docker → MCP server flow
- Add video/GIF: screen recording of build process (optional but helpful)
- Keep concise: aim for "working server in 5 minutes"

**Success Criteria**: Clear quick start; user can build first MCP server quickly; links to deeper docs; addresses common issues

### Task 10.6: Build API Documentation

**Goal**: Generate and publish TypeScript API documentation.

**Actions**:

- Install TypeDoc: `npm install --save-dev typedoc`
- Configure TypeDoc: create `typedoc.json` with entryPoints, out directory, theme, exclude patterns
- Add JSDoc comments: enhance existing code with @param, @returns, @throws, @example tags
- Document public interfaces: Module, Tool, Connector, Config, BuildOptions, etc.
- Generate docs: `npm run docs` script runs typedoc, outputs to /docs/api
- Add code examples: inline examples in docs showing how to use each API
- Include architecture diagrams: show how components interact, class diagrams for main types
- Create contribution guide: `CONTRIBUTING.md` with setup, coding standards, PR process, testing requirements
- Host docs: optionally publish to GitHub Pages or Netlify

**Success Criteria**: Complete API docs generated; well-commented code; includes examples; contribution guide available

## Phase 11: Advanced Features

### Task 11.1: Add Multi-Language Support

**Goal**: Enable tools and connectors written in Python alongside TypeScript.

**Actions**:

- Extend `loader.ts`: add Python file handling, parse Python docstrings for metadata using regex or python-ast
- Update Dockerfile generator: detect if Python modules present, add Python runtime to generated image
- Add Python requirements: scan Python files for imports, generate requirements.txt, pip install in Dockerfile
- Implement language-agnostic invocation: for Python tools, spawn child process or use Python bridge library
- Add polyglot dependency management: separate npm packages and pip packages, install both in generated server
- Create Python tool template: example Python tool with proper metadata format in docstring
- Update tool-loader template: handle both .js and .py module imports, route to appropriate executor
- Include mixed-language example: one TypeScript tool, one Python tool in same MCP server
- Document in tool development guide: how to write Python tools, metadata format differences

**Success Criteria**: Loads Python modules; generates images with both runtimes; executes Python tools; example working

### Task 11.2: Implement Hot Reload

**Goal**: Enable development mode where tools reload without rebuilding container.

**Actions**:

- Add file watching to generated server: use chokidar to watch /tools and /connectors directories
- Implement dynamic tool reloading: on file change, invalidate require cache, re-import module, re-register tool
- Add configuration hot-reload: watch config file, on change re-parse and update runtime config without restart
- Include zero-downtime updates: queue requests during reload, process after new version loaded
- Add reload event hooks: beforeReload, afterReload for cleanup/reinitialization
- Create development mode flag: --dev enables hot reload, disabled in production for safety
- Implement graceful error handling: if reload fails, keep old version, log error, don't crash
- Add reload endpoint: POST /admin/reload to trigger manual reload
- Document dev workflow: mount volumes for hot reload, faster iteration

**Success Criteria**: Files changes reload automatically; config updates without restart; graceful error handling; dev mode works

### Task 11.3: Create Health & Monitoring

**Goal**: Add comprehensive health checks and metrics collection.

**Actions**:

- Add health check endpoints: /health (basic), /health/ready (readiness), /health/live (liveness) for Kubernetes
- Implement Prometheus metrics: use prom-client library, expose /metrics endpoint with request counters, latencies, tool invocation counts
- Add structured logging: use pino or winston with JSON format, include request IDs, timestamps, correlation IDs
- Include distributed tracing: integrate OpenTelemetry, trace tool invocations, connector calls, full request path
- Create metrics for each tool: invocation count, success/failure rate, average duration, 95th percentile latency
- Add connector health: include in /health endpoint, show status of each connector (connected/disconnected/error)
- Create example Grafana dashboard: JSON export with panels for key metrics, request rates, error rates
- Add alerting examples: Prometheus rules for high error rate, slow responses, connector failures
- Document monitoring setup: how to scrape metrics, set up Grafana, configure alerts

**Success Criteria**: Health endpoints work; Prometheus metrics exposed; structured logging; tracing integrated; dashboard example

### Task 11.4: Build Plugin System

**Goal**: Allow extending generator with custom plugins.

**Actions**:

- Define plugin interface: `interface Plugin { name: string; version: string; hooks: { beforeBuild?, afterBuild?, beforeDeploy?, onToolLoaded? } }`
- Implement plugin discovery: scan /plugins directory, load modules exporting Plugin interface
- Add plugin lifecycle hooks: call at appropriate times during build process, pass context (manifest, config, etc.)
- Include plugin configuration: allow plugins to declare config options, read from config.plugins section
- Create example plugins: logger plugin (enhanced logging), validator plugin (custom validation rules), notifier plugin (Slack notifications on build)
- Add plugin registry: track loaded plugins, enable/disable individual plugins via config
- Implement plugin dependencies: plugins can depend on other plugins, load in correct order
- Document plugin API: write docs/plugin-development.md with interface, hooks, examples
- Add security: validate plugin signatures, sandboxing considerations

**Success Criteria**: Plugin system functional; hooks called correctly; example plugins work; well-documented

### Task 11.5: Add Testing Framework for Generated Servers

**Goal**: Provide testing utilities for validating generated MCP servers.

**Actions**:

- Create `base/testing/test-harness.ts` with utilities for testing generated servers
- Build MCP protocol tester: class MCPClient with methods `callTool(name, args)`, `listTools()`, verifies JSON-RPC 2.0 protocol compliance
- Implement tool mocking framework: allow replacing real tool implementations with mocks for testing, `mockTool(name, mockFn)`
- Add load testing tools: use autocannon or k6, create scripts for stress testing MCP endpoints, configurable concurrency/duration
- Create regression test generator: capture actual tool invocations, save as test cases, replay to detect behavior changes
- Include assertion helpers: `expectToolResponse(expected)`, `expectError(errorCode)`, `expectConnectorState(state)`
- Add Docker test helpers: start/stop test containers, cleanup, port management
- Create example test suite: demonstrate testing custom MCP server with multiple tools
- Document testing best practices: unit vs integration, mocking strategies, performance testing

**Success Criteria**: Test harness works; MCP client validates protocol; mocking system functional; load tests run; documented

## Phase 12: Security & Hardening

### Task 12.1: Implement Secret Encryption

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

### Task 12.2: Add Security Scanning

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

### Task 12.3: Create Security Hardening Guide

**Goal**: Comprehensive documentation for securing MCP servers in production.

**Actions**:

- Create `docs/security.md` with security best practices
- Document least-privilege configurations: run containers as non-root user (USER node in Dockerfile), drop unnecessary capabilities
- Add network isolation patterns: use Docker networks, firewall rules, restrict outbound connections, egress filtering
- Include secret management: never hardcode secrets, use environment variables, integrate with secrets managers (Vault, AWS Secrets Manager)
- Add authentication recommendations: implement API keys or OAuth for MCP endpoints, mutual TLS for service-to-service
- Document input validation: sanitize all tool inputs, prevent injection attacks, validate against schemas
- Include rate limiting: protect against DoS, implement per-client rate limits, use middleware
- Add security headers: HTTPS only, HSTS, CSP, X-Frame-Options in HTTP responses
- Create security checklist: pre-deployment verification steps, penetration testing recommendations
- Document incident response: logging for forensics, audit trails, breach notification procedures
- Include compliance: GDPR, SOC2, HIPAA considerations for handling sensitive data

**Success Criteria**: Comprehensive security guide; covers authentication, network, secrets; includes checklist; compliance guidance

### Task 12.4: Implement RBAC for Tools

**Goal**: Add role-based access control to restrict tool access by user/role.

**Actions**:

- Create `base/rbac.ts` with RBAC system: define Roles, Permissions, Users
- Define permission model: each tool has required permissions (e.g., `email:read`, `email:send`, `data:query`)
- Implement role definition: `interface Role { name: string, permissions: string[], inherits?: string[] }`
- Add permission checking: middleware `checkPermission(toolName, user)` that verifies user has required permissions
- Create authentication middleware: extract user/API key from request headers, validate, load user's roles
- Implement authorization checks: before tool invocation, verify `user.hasPermission(tool.requiredPermissions)`
- Add role configuration: define roles in config file `rbac: { roles: { admin: [...], viewer: [...] }, users: { ... } }`
- Create audit logging: log all authorization decisions (granted/denied), include user, tool, timestamp
- Add default roles: admin (all permissions), user (basic tools), readonly (query only)
- Implement token-based auth: JWT or API keys, include roles/permissions in token claims
- Document RBAC setup: how to define roles, assign to users, configure per-tool permissions

**Success Criteria**: RBAC system functional; roles and permissions configurable; authorization enforced; audit logging works; documented

## Phase 13: CI/CD & Automation

### Task 13.1: Create GitHub Actions Workflow

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

### Task 13.2: Build Example CI Pipeline

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

### Task 13.3: Create Pre-commit Hooks

**Goal**: Enforce code quality and standards before commits.

**Actions**:

- Install husky and lint-staged: `npm install --save-dev husky lint-staged`
- Configure husky: run `npx husky init`, create pre-commit hook that runs lint-staged
- Set up lint-staged in package.json: run ESLint on \*.ts files, Prettier on all files, type checking
- Add code formatting checks: ensure all files formatted with Prettier, auto-fix if possible
- Implement linting: run ESLint with --max-warnings 0, enforce coding standards
- Add commit message validation: use commitlint, enforce conventional commits format (feat:, fix:, docs:)
- Include security checks: run npm audit, block commits if vulnerabilities found (configurable severity)
- Add test running: run affected tests for changed files (optional, can be slow)
- Create bypass option: allow `--no-verify` for emergencies, document when appropriate
- Add documentation checks: verify JSDoc comments present for public functions
- Document pre-commit setup: how to install hooks, what checks run, how to configure

**Success Criteria**: Pre-commit hooks installed; format/lint checks run; commit messages validated; security checked; documented

## Phase 14: Performance & Optimization

### Task 14.1: Optimize Build Times

**Goal**: Reduce Docker build times through caching and optimization.

**Actions**:

- Implement build caching: use Docker BuildKit, enable inline cache `--cache-from`, cache layer results
- Add parallel processing: build independent steps concurrently, use multi-stage builds efficiently
- Optimize Docker layer caching: order Dockerfile instructions from least to most frequently changing
- Implement incremental builds: detect changed tools/connectors, only rebuild affected parts
- Add build performance metrics: track build duration per step, identify bottlenecks, log timing data
- Use .dockerignore: exclude unnecessary files from build context (node_modules, .git, tests)
- Optimize base images: use slim/alpine variants, remove unnecessary packages, minimize layer size
- Implement dependency pre-building: cache npm install layer, only invalidate if package.json changes
- Add remote cache support: push/pull cache layers to/from registry for CI/CD speedup
- Create build profiles: fast (dev, minimal optimization), standard, optimized (prod, full optimization)
- Document optimization techniques: best practices for fast builds, troubleshooting slow builds

**Success Criteria**: Build times reduced significantly; caching works; metrics tracked; parallel builds functional; documented

### Task 14.2: Optimize Generated Server

**Goal**: Improve runtime performance of generated MCP servers.

**Actions**:

- Profile server performance: use Node.js profiler, identify CPU/memory hotspots, use 0x or clinic.js
- Optimize tool loading: implement lazy loading, only load tools when first invoked, reduce startup time
- Add lazy loading for connectors: initialize connectors on-demand, pool connections, close idle connections
- Implement request caching: cache tool results for idempotent operations, configurable TTL, use Redis or in-memory
- Add response compression: gzip/brotli for HTTP responses, reduce bandwidth, faster responses
- Optimize JSON parsing: use faster parsers (like simdjson bindings), reduce serialization overhead
- Implement connection pooling: reuse database/API connections, configure pool sizes based on load
- Add worker threads: offload CPU-intensive tools to worker threads, keep main thread responsive
- Optimize memory usage: profile heap, identify leaks, optimize object allocation patterns
- Create performance monitoring: track p50/p95/p99 latencies, throughput, error rates
- Document performance tuning: configuration options, profiling techniques, optimization strategies

**Success Criteria**: Server performance improved; lazy loading works; caching functional; profiling identifies bottlenecks; documented

### Task 14.3: Add Build Artifact Caching

**Goal**: Cache build artifacts to speed up subsequent builds.

**Actions**:

- Implement dependency caching: cache node_modules directory, hash package-lock.json, invalidate on change
- Add module resolution caching: cache TypeScript compilation results, reuse for unchanged modules
- Cache Docker layers efficiently: structure Dockerfile for maximum cache hits, separate deps from code
- Include remote cache support: push cached layers to registry, pull in CI for faster builds
- Add cache invalidation logic: detect changes to tool files, connectors, config templates, invalidate selectively
- Implement local cache: use .cache directory for build artifacts, respect .gitignore
- Add cache warming: pre-populate cache with common dependencies in CI environment
- Create cache statistics: track hit/miss rates, cache size, time saved
- Add cache cleanup: automatically remove old/unused cache entries, configurable retention
- Implement cache versioning: invalidate cache when generator version changes
- Document caching strategy: what's cached, invalidation rules, troubleshooting cache issues

**Success Criteria**: Artifacts cached effectively; remote cache works; intelligent invalidation; statistics tracked; documented

## Phase 15: Polish & Release Preparation

### Task 15.1: Create Demo Project

**Goal**: Build comprehensive demonstration of MCP generator capabilities.

**Actions**:

- Create `examples/demo-workspace/` directory structure with tools/, connectors/, config/
- Build variety of tools: text-summarizer (simple), code-analyzer (complex), image-processor (multi-step)
- Include connectors: Gmail (OAuth), Notion (token auth), PostgreSQL (database), Slack (webhooks)
- Add demo configuration: config.demo.yaml with sample settings, environment variable examples, comments
- Create demo deployment script: `demo.sh` that builds server, starts container, runs sample requests, shows output
- Add sample data: test emails, documents, database schema for realistic demo
- Create interactive demo: CLI that lets users try different tools, see results in real-time
- Record demo video: screen capture showing build process, server startup, tool invocation, results
- Take screenshots: architecture diagram, terminal output, generated Dockerfile, running server
- Add demo documentation: README in examples/ explaining what each component demonstrates
- Include performance demo: show scaling, concurrent requests, metrics dashboard

**Success Criteria**: Comprehensive demo workspace; multiple tools/connectors; deployment script works; video/screenshots ready; documented

### Task 15.2: Finalize Documentation

**Goal**: Review and polish all documentation for release readiness.

**Actions**:

- Review all docs for accuracy: verify code examples work, links aren't broken, commands produce expected output
- Add missing sections: identify gaps in documentation, add explanations for undocumented features
- Create table of contents: add to README and each doc file, use markdown TOC, link to sections
- Add cross-references: link between related docs, e.g., tool guide → config guide → deployment guide
- Proofread and edit: fix typos, improve clarity, ensure consistent terminology, check grammar
- Standardize formatting: consistent heading levels, code block languages, bullet points, numbering
- Add examples throughout: ensure every concept has code example, show both good and bad practices
- Create visual aids: add diagrams for architecture, workflows, data flow using Mermaid or images
- Verify all commands: test every CLI command shown in docs, update if syntax changed
- Add version indicators: note which features require specific versions, mark deprecated features
- Create documentation index: single page linking to all docs with brief descriptions

**Success Criteria**: All docs reviewed; no broken links; consistent formatting; adequate examples; visuals added; index created

### Task 15.3: Create Release Checklist

**Goal**: Define formal release process and version management.

**Actions**:

- Define version numbering: use Semantic Versioning (MAJOR.MINOR.PATCH), document when to increment each
- Create release notes template: `RELEASE_NOTES.md` with sections for Features, Bug Fixes, Breaking Changes, Deprecations
- Add migration guides: for breaking changes, provide step-by-step upgrade instructions, code examples
- Include upgrade instructions: how to upgrade from previous version, data migration if needed, config changes
- Define support policy: how long each version supported, LTS vs regular releases, security patch policy
- Create pre-release checklist: tests pass, docs updated, changelog complete, demo works, security scan clean
- Add release branch strategy: main for development, release/v1.x for stable, tags for specific versions
- Include rollback plan: how to revert to previous version if release has critical issues
- Create deprecation policy: how much notice before removing features, migration path required
- Add community communication: announcement template for releases, where to post (GitHub, Discord, Twitter)
- Document hotfix process: emergency patch procedure, version numbering for hotfixes

**Success Criteria**: Versioning scheme defined; release notes template ready; migration guides planned; support policy clear; checklist complete

### Task 15.4: Build Community Resources

**Goal**: Set up infrastructure for community engagement and contributions.

**Actions**:

- Create issue templates: `.github/ISSUE_TEMPLATE/` with Bug Report, Feature Request, Question templates using GitHub issue forms
- Add pull request template: `.github/PULL_REQUEST_TEMPLATE.md` with checklist (tests added, docs updated, changelog entry)
- Create contribution guidelines: `CONTRIBUTING.md` with how to set up dev environment, coding standards, commit message format, review process
- Add code of conduct: `CODE_OF_CONDUCT.md` using Contributor Covenant, define expected behavior, reporting process
- Set up discussions: enable GitHub Discussions with categories (Q&A, Ideas, Show and Tell, General)
- Create community forum: optional Discord server or Slack workspace with channels (support, development, announcements)
- Add contributing documentation: docs/contributing/ with architecture overview, how to add features, testing guide
- Create good first issue labels: tag beginner-friendly issues, provide mentorship offers
- Add maintainer guide: how to review PRs, triage issues, release process, decision-making
- Set up project board: GitHub Projects for roadmap, track features in progress, community contributions
- Create contributor recognition: CONTRIBUTORS.md or all-contributors bot to acknowledge contributions

**Success Criteria**: Issue/PR templates created; contribution guide complete; code of conduct added; community spaces set up; welcoming atmosphere

### Task 15.5: Prepare Initial Release

**Goal**: Execute first public release of MCP generator.

**Actions**:

- Tag version: create git tag `v1.0.0-beta` or `v1.0.0` depending on maturity level
- Publish Docker images: push to Docker Hub (mcpgen/generator:latest, :v1.0.0) and GitHub Container Registry (ghcr.io/klogdog/easymcp:latest)
- Create GitHub release: use tag, attach release notes, include binaries/artifacts if applicable, mark as pre-release if beta
- Verify published artifacts: pull Docker image, test it works, check all tags present
- Announce on relevant channels: post to Reddit (r/docker, r/programming), Hacker News, Dev.to, Twitter/X, LinkedIn
- Update package registries: if applicable, publish to npm registry for CLI tool
- Create announcement post: blog post or README explaining what it is, why it's useful, how to get started
- Monitor initial feedback: watch GitHub issues, discussions, social media for problems, questions, suggestions
- Prepare for support: be ready to quickly fix critical bugs, answer questions, update docs based on feedback
- Create launch checklist: verify all links work, demo functional, docs complete, tests passing, security scan clean
- Plan post-launch: roadmap for next version, feature priorities based on feedback, community building strategy

**Success Criteria**: Version tagged; images published; GitHub release created; announced publicly; monitoring feedback; responsive to issues

---

## Notes

- Each task is designed to be completed in a single focused work session (2-4 hours)
- Tasks within phases can often be parallelized
- Some tasks have dependencies on earlier phases - respect the sequential order between phases
- Testing tasks should be executed alongside development tasks for rapid feedback
- Documentation should be updated incrementally as features are completed
