# Task 5.3: Create Connector Integration Template

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
