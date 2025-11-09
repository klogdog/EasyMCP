# Task 7.3: Create Config Override System

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
