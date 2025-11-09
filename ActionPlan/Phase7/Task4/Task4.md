# Task 7.4: Build Default Config Template

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
