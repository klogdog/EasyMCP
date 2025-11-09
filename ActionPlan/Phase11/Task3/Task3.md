# Task 11.3: Create Health & Monitoring

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
