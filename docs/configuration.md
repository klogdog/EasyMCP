# Configuration Guide

A comprehensive guide to configuring EasyMCP servers and components.

## Table of Contents

1. [Configuration Overview](#configuration-overview)
2. [Configuration Sections](#configuration-sections)
3. [Environment Variables](#environment-variables)
4. [Configuration Override](#configuration-override)
5. [Configuration Recipes](#configuration-recipes)
6. [Security Best Practices](#security-best-practices)
7. [Validation](#validation)
8. [Migration Guide](#migration-guide)
9. [Troubleshooting](#troubleshooting)

---

## Configuration Overview

### Configuration Files

EasyMCP uses YAML configuration files located in the `/config` directory:

```
/config
├── config.yaml           # Main configuration (auto-loaded)
├── config.dev.yaml       # Development overrides
├── config.prod.yaml      # Production overrides
├── schema.yaml           # Configuration schema documentation
└── config.yaml.template  # Template for new configurations
```

### File Loading Order

Configuration is loaded and merged in this order:

1. **Default values** - Built-in defaults
2. **`config.yaml`** - Base configuration
3. **Environment-specific** - `config.{NODE_ENV}.yaml`
4. **Environment variables** - Override any value
5. **CLI arguments** - Highest priority

### Configuration Format

```yaml
# config.yaml
server:
  name: my-mcp-server
  version: 1.0.0
  host: localhost
  port: ${PORT:-3000}  # Environment variable with default

database:
  type: postgres
  url: ${DATABASE_URL}  # Required environment variable

logging:
  level: info
  format: json
```

---

## Configuration Sections

### Server Configuration

Controls how the MCP server binds and operates.

```yaml
server:
  # Required: Unique server name
  name: mcp-server
  
  # Required: Server version (semver)
  version: 1.0.0
  
  # Host address to bind to
  # - "localhost": Development only
  # - "0.0.0.0": Accept all connections (production)
  # - "127.0.0.1": IPv4 loopback only
  host: localhost  # Default: localhost
  
  # TCP port number (1-65535)
  port: 3000  # Default: 8080
  
  # Enable CORS headers
  cors: false  # Default: false
  
  # Maximum request body size
  # Supports: kb, mb, gb
  maxRequestSize: 10mb  # Default: 10mb
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | ✅ | - | Unique server identifier |
| `version` | string | ✅ | - | Semantic version (x.y.z) |
| `host` | string | ❌ | `localhost` | Bind address |
| `port` | number | ❌ | `8080` | Listen port |
| `cors` | boolean | ❌ | `false` | Enable CORS |
| `maxRequestSize` | string | ❌ | `10mb` | Max request body |

### Database Configuration

Database connection settings for persistent storage.

```yaml
database:
  # Database type/driver
  type: postgres  # Options: postgres, sqlite, mysql
  
  # Connection URL (use env var for security)
  url: ${DATABASE_URL}
  
  # Connection pool settings
  pool:
    min: 2        # Minimum connections
    max: 10       # Maximum connections
    idleTimeout: 30000  # Idle timeout (ms)
  
  # Query timeout (ms)
  timeout: 5000
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `type` | string | ❌ | `sqlite` | Database driver |
| `url` | string | ❌ | - | Connection URL |
| `pool.min` | number | ❌ | `2` | Min pool connections |
| `pool.max` | number | ❌ | `10` | Max pool connections |
| `pool.idleTimeout` | number | ❌ | `30000` | Idle timeout (ms) |
| `timeout` | number | ❌ | `5000` | Query timeout (ms) |

#### Database URL Formats

```yaml
# SQLite (local file)
database:
  type: sqlite
  url: sqlite:./data/mcp.db

# PostgreSQL
database:
  type: postgres
  url: postgres://user:password@localhost:5432/dbname

# MySQL
database:
  type: mysql
  url: mysql://user:password@localhost:3306/dbname

# Using environment variable
database:
  type: postgres
  url: ${DATABASE_URL}
```

### Services Configuration

External service integrations (APIs, third-party services).

```yaml
services:
  # OpenAI integration
  openai:
    apiKey: ${OPENAI_API_KEY}
    endpoint: https://api.openai.com/v1
    timeout: 30000
    rateLimit:
      requestsPerMinute: 60
      retryAfter: 1000
  
  # Custom service
  myservice:
    apiKey: ${MY_SERVICE_API_KEY}
    endpoint: https://api.myservice.com
    timeout: 10000
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `apiKey` | string | Varies | API authentication key |
| `endpoint` | string | ❌ | Base URL for API |
| `timeout` | number | ❌ | Request timeout (ms) |
| `rateLimit.requestsPerMinute` | number | ❌ | Max requests/min |
| `rateLimit.retryAfter` | number | ❌ | Retry delay (ms) |

### Connectors Configuration

Connector configurations for data sources and integrations.

```yaml
connectors:
  # Database connector
  database-connector:
    type: database
    enabled: true
    credentials:
      url: ${DATABASE_CONNECTOR_URL}
      username: ${DATABASE_CONNECTOR_USERNAME}
      password: ${DATABASE_CONNECTOR_PASSWORD}
    settings:
      availableMethods:
        - query
        - insert
        - update
        - delete
  
  # Email connector
  email-connector:
    type: email
    enabled: true
    credentials:
      apiKey: ${EMAIL_API_KEY}
      fromEmail: noreply@example.com
    settings:
      availableMethods:
        - send
        - receive
        - list
      mockMode: false
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | ✅ | Connector type (database, email, api, file, custom) |
| `enabled` | boolean | ❌ | Whether connector is active (default: true) |
| `credentials` | object | ❌ | Authentication credentials |
| `settings` | object | ❌ | Connector-specific settings |

### Logging Configuration

Logging settings for observability and debugging.

```yaml
logging:
  # Log level threshold
  # Options: debug, info, warn, error
  level: info
  
  # Log output format
  # Options: json, text, pretty
  format: json
  
  # Output destination
  # Options: stdout, stderr, console, file
  destination: stdout
  
  # File logging (when destination: file)
  filePath: /var/log/mcp-server.log
  rotation:
    maxSize: 100mb      # Max file size before rotation
    maxFiles: 10        # Number of rotated files to keep
    compress: true      # Compress rotated files
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `level` | string | ❌ | `info` | Minimum log level |
| `format` | string | ❌ | `json` | Output format |
| `destination` | string | ❌ | `stdout` | Log destination |
| `filePath` | string | ❌ | - | Log file path |
| `rotation.maxSize` | string | ❌ | `100mb` | Max file size |
| `rotation.maxFiles` | number | ❌ | `10` | Rotated files to keep |
| `rotation.compress` | boolean | ❌ | `true` | Compress old logs |

### Features Configuration

Enable or disable specific features.

```yaml
features:
  # Tool features
  add: true
  subtract: true
  multiply: true
  divide: true
  
  # File operations
  read: true
  stat: true
  list: true
  
  # Integrations
  databaseIntegration: true
  emailIntegration: true
  
  # Experimental (disabled by default in production)
  experimentalFeature: false
```

---

## Environment Variables

### Environment Variable Reference

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `NODE_ENV` | Environment mode | `development` | `production` |
| `PORT` | Server port | `8080` | `3000` |
| `HOST` | Server host | `localhost` | `0.0.0.0` |
| `DATABASE_URL` | Database connection | - | `postgres://...` |
| `LOG_LEVEL` | Logging level | `info` | `debug` |
| `OPENAI_API_KEY` | OpenAI API key | - | `sk-...` |

### Connector Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_CONNECTOR_URL` | Database connector URL | Yes |
| `DATABASE_CONNECTOR_USERNAME` | Database username | No |
| `DATABASE_CONNECTOR_PASSWORD` | Database password | No |
| `EMAIL_API_KEY` | Email service API key | Yes |
| `EMAIL_FROM` | Default from address | No |
| `GMAIL_CLIENT_ID` | Gmail OAuth client ID | Yes* |
| `GMAIL_CLIENT_SECRET` | Gmail OAuth secret | Yes* |
| `GMAIL_REFRESH_TOKEN` | Gmail refresh token | Yes* |
| `NOTION_TOKEN` | Notion API token | Yes* |
| `SLACK_BOT_TOKEN` | Slack bot token | Yes* |

*Required if connector is enabled

### Environment Variable Substitution

Use `${VAR_NAME}` syntax in YAML files:

```yaml
# Required variable (fails if not set)
database:
  url: ${DATABASE_URL}

# Optional variable with default
server:
  port: ${PORT:-8080}

# Nested in string
logging:
  filePath: /var/log/${APP_NAME:-mcp}-server.log

# Multiple variables
services:
  custom:
    endpoint: ${API_PROTOCOL:-https}://${API_HOST}:${API_PORT:-443}
```

### Setting Environment Variables

#### Local Development

```bash
# .env file (use dotenv)
DATABASE_URL=postgres://localhost:5432/mcp
OPENAI_API_KEY=sk-test-key
PORT=3000

# Or export directly
export DATABASE_URL="postgres://localhost:5432/mcp"
export OPENAI_API_KEY="sk-test-key"
```

#### Docker

```bash
# docker run
docker run -e DATABASE_URL="postgres://..." -e PORT=8080 mcp-server

# docker-compose.yml
services:
  mcp-server:
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    env_file:
      - .env.production
```

#### Kubernetes

```yaml
# ConfigMap for non-sensitive values
apiVersion: v1
kind: ConfigMap
metadata:
  name: mcp-config
data:
  PORT: "8080"
  LOG_LEVEL: "info"

# Secret for sensitive values
apiVersion: v1
kind: Secret
metadata:
  name: mcp-secrets
type: Opaque
stringData:
  DATABASE_URL: "postgres://user:pass@host:5432/db"
  OPENAI_API_KEY: "sk-..."

# Pod spec
spec:
  containers:
  - name: mcp-server
    envFrom:
    - configMapRef:
        name: mcp-config
    - secretRef:
        name: mcp-secrets
```

---

## Configuration Override

### Override Precedence

From lowest to highest priority:

1. Default values in code
2. `config.yaml`
3. `config.{NODE_ENV}.yaml`
4. Environment variables
5. CLI arguments

### Environment-Specific Files

```yaml
# config.dev.yaml - Development overrides
server:
  host: localhost
  port: 3000

logging:
  level: debug
  format: pretty

features:
  experimentalFeature: true
```

```yaml
# config.prod.yaml - Production overrides
server:
  host: 0.0.0.0
  port: ${PORT:-8080}

logging:
  level: info
  format: json

features:
  experimentalFeature: false
```

### CLI Arguments

```bash
# Override specific values
npm start -- --port=9000 --log-level=debug

# Override with config file
npm start -- --config=/path/to/custom-config.yaml
```

### Merging Behavior

Configuration objects are deep-merged:

```yaml
# config.yaml
database:
  type: postgres
  pool:
    min: 2
    max: 10

# config.prod.yaml
database:
  pool:
    max: 50  # Only this value changes

# Result
database:
  type: postgres  # From config.yaml
  pool:
    min: 2        # From config.yaml
    max: 50       # Overridden by config.prod.yaml
```

---

## Configuration Recipes

### Recipe: Local Development Setup

```yaml
# config.dev.yaml
server:
  name: mcp-dev
  version: 0.1.0
  host: localhost
  port: 3000
  cors: true  # Allow frontend dev server

database:
  type: sqlite
  url: sqlite:./data/dev.db

logging:
  level: debug
  format: pretty
  destination: console

connectors:
  email-connector:
    type: email
    enabled: true
    settings:
      mockMode: true  # Don't send real emails

features:
  experimentalFeature: true
```

### Recipe: Production Deployment

```yaml
# config.prod.yaml
server:
  name: mcp-prod
  version: 1.0.0
  host: 0.0.0.0
  port: ${PORT:-8080}
  cors: false

database:
  type: postgres
  url: ${DATABASE_URL}
  pool:
    min: 5
    max: 50
    idleTimeout: 30000

logging:
  level: info
  format: json
  destination: stdout

features:
  experimentalFeature: false
```

### Recipe: Multi-Service Architecture

```yaml
# config.yaml
server:
  name: mcp-gateway
  version: 1.0.0

services:
  # User service
  users:
    endpoint: ${USER_SERVICE_URL:-http://user-service:8081}
    timeout: 5000
  
  # Order service
  orders:
    endpoint: ${ORDER_SERVICE_URL:-http://order-service:8082}
    timeout: 10000
  
  # Notification service
  notifications:
    endpoint: ${NOTIFICATION_SERVICE_URL:-http://notification-service:8083}
    timeout: 3000

connectors:
  # Shared database
  main-db:
    type: database
    credentials:
      url: ${MAIN_DATABASE_URL}
  
  # Cache
  redis:
    type: custom
    credentials:
      url: ${REDIS_URL:-redis://localhost:6379}
```

### Recipe: High Availability

```yaml
# config.ha.yaml
server:
  name: mcp-ha-node
  host: 0.0.0.0
  port: ${PORT:-8080}

database:
  type: postgres
  url: ${DATABASE_URL}
  pool:
    min: 10
    max: 100
    idleTimeout: 10000
  
  # Connection retry
  retry:
    maxAttempts: 5
    delay: 1000
    maxDelay: 30000

# Health check endpoint
healthCheck:
  enabled: true
  path: /health
  interval: 10000

# Graceful shutdown
shutdown:
  timeout: 30000
  drainConnections: true
```

### Recipe: Testing Configuration

```yaml
# config.test.yaml
server:
  name: mcp-test
  port: 0  # Random available port

database:
  type: sqlite
  url: sqlite::memory:  # In-memory database

logging:
  level: error  # Only errors during tests
  format: text

connectors:
  email-connector:
    settings:
      mockMode: true
  
  database-connector:
    settings:
      mockMode: true

features:
  # Enable all features for testing
  add: true
  subtract: true
  multiply: true
  divide: true
```

---

## Security Best Practices

### Never Commit Secrets

```bash
# .gitignore
.env
.env.*
!.env.example
*.pem
*.key
secrets/
```

```yaml
# ❌ NEVER do this
database:
  url: postgres://admin:supersecret@db.example.com/prod

# ✅ Always use environment variables
database:
  url: ${DATABASE_URL}
```

### Use Environment Variables for Secrets

```bash
# .env.example (commit this)
DATABASE_URL=postgres://user:password@localhost:5432/dbname
OPENAI_API_KEY=sk-your-key-here
EMAIL_API_KEY=your-api-key

# .env (never commit)
DATABASE_URL=postgres://admin:realpassword@prod-db.example.com/mcp
OPENAI_API_KEY=sk-live-xxxxxxxxxxxxx
```

### Encrypt at Rest

```yaml
# Use encrypted secret stores
secrets:
  provider: vault
  address: ${VAULT_ADDR}
  token: ${VAULT_TOKEN}
  path: secret/mcp/

# Or AWS Secrets Manager
secrets:
  provider: aws-secrets-manager
  region: us-west-2
  secretId: mcp/production
```

### Rotate Credentials Regularly

```bash
# Create rotation script
#!/bin/bash
# rotate-secrets.sh

# Generate new API key
NEW_KEY=$(generate-api-key)

# Update secret store
aws secretsmanager update-secret \
  --secret-id mcp/production \
  --secret-string "{\"API_KEY\":\"$NEW_KEY\"}"

# Trigger rolling restart
kubectl rollout restart deployment/mcp-server
```

### Validate Configuration

```bash
# Validate before deployment
npm run config:validate -- --config=config.prod.yaml

# Dry run to check configuration
npm start -- --dry-run
```

---

## Validation

### Validate Configuration File

```bash
# Validate current configuration
npm run config:validate

# Validate specific file
npm run config:validate -- --config=/path/to/config.yaml

# Validate with environment
NODE_ENV=production npm run config:validate
```

### Dry Run Mode

```bash
# Check configuration without starting server
npm start -- --dry-run

# Output:
# ✓ Configuration loaded
# ✓ Database connection validated
# ✓ Connectors initialized
# ✓ All features enabled
# Ready to start (dry-run mode)
```

### Schema Validation

Configuration is validated against the schema:

```yaml
# config/schema.yaml defines:
server:
  port:
    type: number
    minimum: 1
    maximum: 65535

# Invalid configuration:
server:
  port: 99999  # Error: port must be <= 65535

# Valid configuration:
server:
  port: 8080  # ✓
```

### Validation Errors

Common validation errors and fixes:

```
Error: Missing required field: server.name
Fix: Add 'name' under 'server' section

Error: Invalid type for 'port': expected number, got string
Fix: Remove quotes from port value: port: 8080 (not "8080")

Error: Unknown field: server.logging
Fix: Move 'logging' to root level (not under 'server')

Error: Environment variable DATABASE_URL is not set
Fix: Export DATABASE_URL or add default: ${DATABASE_URL:-sqlite:./dev.db}
```

---

## Migration Guide

### Migrating Between Versions

#### From v0.x to v1.x

```yaml
# Old format (v0.x)
serverName: my-server
serverPort: 3000
dbUrl: postgres://...

# New format (v1.x)
server:
  name: my-server
  port: 3000
database:
  url: postgres://...
```

#### Migration Script

```bash
# Run migration tool
npm run config:migrate -- --from=0.x --to=1.x --input=old-config.yaml --output=new-config.yaml
```

### Breaking Changes

| Version | Change | Migration |
|---------|--------|-----------|
| 1.0.0 | Nested server config | Move `serverName` to `server.name` |
| 1.0.0 | Database config | Move `dbUrl` to `database.url` |
| 1.1.0 | Logging format | Add `logging.format` field |
| 1.2.0 | Connector credentials | Move inline creds to `credentials` object |

---

## Troubleshooting

### Config Validation Errors

#### "Environment variable X is not set"

**Cause**: Required environment variable is missing.

**Solution**:
```bash
# Check if variable is set
echo $DATABASE_URL

# Set the variable
export DATABASE_URL="postgres://..."

# Or use a .env file
echo 'DATABASE_URL=postgres://...' >> .env
```

#### "Invalid YAML syntax"

**Cause**: YAML formatting error.

**Solution**:
```yaml
# ❌ Wrong (inconsistent indentation)
server:
  name: test
   port: 3000  # Wrong: 3 spaces instead of 2

# ✅ Correct
server:
  name: test
  port: 3000
```

```yaml
# ❌ Wrong (missing quotes on special characters)
server:
  name: my-server: special  # Colon needs quotes

# ✅ Correct
server:
  name: "my-server: special"
```

#### "Unknown configuration field"

**Cause**: Typo or deprecated field.

**Solution**:
```yaml
# ❌ Wrong
server:
  prot: 3000  # Typo: should be 'port'

# ✅ Correct
server:
  port: 3000
```

### Secrets Issues

#### "Cannot decrypt secret"

**Cause**: Wrong encryption key or corrupted secret.

**Solution**:
```bash
# Re-encrypt secrets with current key
npm run secrets:reencrypt

# Or regenerate secrets
npm run secrets:generate
```

#### "Secret not found in vault"

**Cause**: Secret path doesn't exist or wrong permissions.

**Solution**:
```bash
# Check secret exists
vault kv get secret/mcp/production

# Check permissions
vault token capabilities secret/mcp/production
```

### Loading Order Issues

#### "Config value not applied"

**Cause**: Value overridden by higher-priority source.

**Debug**:
```bash
# Print effective configuration
npm run config:show

# Show merge trace
npm run config:debug
```

**Solution**: Check override precedence:
1. Check CLI arguments
2. Check environment variables
3. Check environment-specific file
4. Check base config.yaml

---

## Next Steps

- [Tool Development Guide](./tool-development.md) - Configure tools
- [Connector Development Guide](./connector-development.md) - Configure connectors
- [Deployment Guide](./deployment.md) - Deploy with proper configuration
- [API Documentation](./api/index.html) - Configuration API reference
