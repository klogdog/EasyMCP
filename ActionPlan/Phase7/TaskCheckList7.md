# Task Checklist for Phase 7: Configuration Management

## Overview

This phase focuses on configuration management.

## Tasks

### Task 7.1: Create Config Schema Definition

- [ ] Create `config/schema.yaml` with complete config structure documentation
- [ ] Define database section: `database: { type: 'postgres'|'sqlite'|'mysql', url: string, pool: { min: number, max: number, idleTimeout: number } }`
- [ ] Define services section: `services: { [serviceName: string]: { apiKey?: string, endpoint?: string, timeout?: number } }`
- [ ] Add logging section: `logging: { level: 'debug'|'info'|'warn'|'error', format: 'json'|'text', destination: 'stdout'|'file', filePath?: string }`
- [ ] Include feature flags: `features: { [featureName: string]: boolean }` for toggling functionality
- [ ] Add server section: `server: { port: number, host: string, cors: boolean, maxRequestSize: string }`
- [ ] Include JSON Schema version of same structure in `config/schema.json` for validation
- [ ] Add examples for each field with comments
- [ ] **Success Criteria**: Complete schema covering all config options; both YAML and JSON Schema versions; well-documented


### Task 7.2: Build Config Parser

- [ ] Create `base/config-parser.ts` with `async function parseConfig(filePath: string): Promise<Config>`
- [ ] Implement YAML parsing: use js-yaml, handle syntax errors gracefully with line numbers
- [ ] Add JSON support as fallback: try parsing as JSON if YAML fails
- [ ] Implement env var substitution: replace `${VAR_NAME}` with `process.env.VAR_NAME`, support defaults `${VAR:-default}`
- [ ] Add recursive substitution: handle nested objects, arrays
- [ ] Implement default values: merge with defaults from schema, only override what's specified
- [ ] Add validation: use Zod schema based on config/schema.json, return detailed error messages with field paths
- [ ] Include type generation: export TypeScript types matching config structure
- [ ] Handle missing files: return sensible defaults or throw descriptive error based on strict mode
- [ ] **Success Criteria**: Parses YAML/JSON; substitutes env vars with defaults; validates against schema; handles errors clearly


### Task 7.3: Create Config Override System

- [ ] Extend `config-parser.ts` with `function mergeConfigs(base: Config, ...overrides: Partial<Config>[]): Config`
- [ ] Implement CLI argument parsing: accept `--config.server.port=3000` style args, parse into nested object
- [ ] Add environment-specific configs: load `config.{env}.yaml` based on NODE_ENV, merge with base config
- [ ] Implement merge strategy: deep merge for objects, replace for primitives, concat for arrays (configurable)
- [ ] Add precedence order: defaults < config file < env-specific file < environment variables < CLI args
- [ ] Create debugging utility: `--debug-config` flag that prints final merged config with source annotations
- [ ] Implement config watching: optionally reload config on file change (for development)
- [ ] Add validation after merge: ensure final config still passes schema validation
- [ ] **Success Criteria**: Merges multiple config sources; respects precedence; supports env-specific files; has debug mode


### Task 7.4: Build Default Config Template

- [ ] Create `config/config.yaml.template` with all sections and inline comments
- [ ] Add sensible defaults: port 8080, log level info, SQLite database for dev, connection pool min=2 max=10
- [ ] Include inline documentation: comment above each field explaining purpose, valid values, examples
- [ ] Add placeholder values for secrets: use `${API_KEY}` syntax, note which are required vs optional
- [ ] Create dev variant `config.dev.yaml`: verbose logging, localhost bindings, permissive CORS, SQLite
- [ ] Create production variant `config.prod.yaml`: structured JSON logs, external DB required, strict security
- [ ] Add security notes: comments warning about sensitive values, recommend using env vars not hardcoding
- [ ] Include example overrides: show how to override via environment variables
- [ ] **Success Criteria**: Complete template with all options; clear documentation; separate dev/prod variants; security guidance

