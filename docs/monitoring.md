# Monitoring Setup Guide

This guide explains how to set up monitoring for your MCP server.

## Overview

The MCP server exposes the following monitoring endpoints:

- `/health` - Basic health status (Kubernetes-compatible)
- `/health/ready` - Readiness probe
- `/health/live` - Liveness probe
- `/metrics` - Prometheus metrics

## Prometheus Metrics

### Available Metrics

| Metric Name                  | Type      | Labels                | Description                    |
| ---------------------------- | --------- | --------------------- | ------------------------------ |
| `mcp_requests_total`         | Counter   | `method`, `status`    | Total requests received        |
| `mcp_tool_invocations_total` | Counter   | `tool_name`, `status` | Tool invocations               |
| `mcp_tool_duration_seconds`  | Histogram | `tool_name`           | Tool execution duration        |
| `mcp_connector_status`       | Gauge     | `connector_name`      | Connector status (1=connected) |
| `mcp_active_connections`     | Gauge     | -                     | Active HTTP connections        |
| `mcp_errors_total`           | Counter   | `type`, `code`        | Error count by type            |

### Scrape Configuration

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: "mcp-server"
    static_configs:
      - targets: ["mcp-server:3000"]
    scrape_interval: 15s
    metrics_path: /metrics
```

### Dynamic Discovery (Kubernetes)

```yaml
scrape_configs:
  - job_name: "mcp-servers"
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        regex: mcp-server
        action: keep
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        regex: "true"
        action: keep
```

## Grafana Dashboard

Import the dashboard from `monitoring/grafana-dashboard.json`:

1. Open Grafana
2. Go to Dashboards → Import
3. Upload or paste the JSON
4. Select your Prometheus datasource
5. Click Import

### Dashboard Panels

- **Request Rate**: Requests per second
- **Error Rate**: Percentage of failed requests
- **P95 Latency**: 95th percentile response time
- **Tool Invocation Rate**: Per-tool call rate
- **Tool Latency Percentiles**: P50/P95/P99 by tool
- **Connector Status**: Health of each connector

## Alerting

Import alerts from `monitoring/prometheus-alerts.yaml`:

```bash
# Copy to Prometheus rules directory
cp monitoring/prometheus-alerts.yaml /etc/prometheus/rules/

# Reload Prometheus
curl -X POST http://localhost:9090/-/reload
```

### Alert Rules

| Alert                    | Severity | Condition                  |
| ------------------------ | -------- | -------------------------- |
| MCPHighErrorRate         | Critical | >5% errors for 5m          |
| MCPSlowResponses         | Warning  | P95 >5s for 5m             |
| MCPConnectorDown         | Critical | Connector disconnected >2m |
| MCPNoRequests            | Warning  | No requests for 10m        |
| MCPToolExecutionFailures | Warning  | >10% tool failures         |
| MCPHighMemoryUsage       | Warning  | >500MB for 10m             |

## Health Checks

### Kubernetes Configuration

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-server
spec:
  template:
    spec:
      containers:
        - name: mcp-server
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
```

### Health Response Examples

#### /health

```json
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2025-11-27T10:00:00Z",
  "version": "1.0.0",
  "tools": ["summarize", "translate"],
  "connectors": ["database", "email"],
  "checks": {
    "connector:database": { "status": "healthy", "latency": 5 },
    "connector:email": { "status": "healthy", "latency": 12 }
  }
}
```

#### /health/ready

```json
{
  "ready": true,
  "timestamp": "2025-11-27T10:00:00Z",
  "checks": {
    "database": true,
    "email": true
  }
}
```

#### /health/live

```json
{
  "alive": true,
  "timestamp": "2025-11-27T10:00:00Z",
  "uptime": 3600,
  "memoryUsage": {
    "heapUsed": 52428800,
    "heapTotal": 104857600,
    "external": 1048576,
    "rss": 157286400
  }
}
```

## Structured Logging

Enable JSON logging for log aggregation:

```yaml
# config.yaml
server:
  logging:
    level: info
    format: json
```

### Log Fields

| Field       | Description            |
| ----------- | ---------------------- |
| `level`     | Log level (10-60)      |
| `time`      | Unix timestamp         |
| `msg`       | Log message            |
| `requestId` | Request correlation ID |
| `traceId`   | Distributed trace ID   |
| `spanId`    | Span ID                |

### Log Aggregation

Works with:

- Elasticsearch/Kibana (ELK)
- Loki/Grafana
- Splunk
- CloudWatch Logs
- Datadog

## Distributed Tracing

The server supports W3C Trace Context for distributed tracing.

### Headers

- `traceparent`: Trace context propagation
- `tracestate`: Vendor-specific trace state

### Example

```http
POST /mcp HTTP/1.1
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

### Integration

Compatible with:

- OpenTelemetry Collector
- Jaeger
- Zipkin
- AWS X-Ray
- Google Cloud Trace

## Docker Compose Example

```yaml
version: "3.8"
services:
  mcp-server:
    image: my-mcp-server:latest
    ports:
      - "3000:3000"
    labels:
      - "prometheus.scrape=true"
      - "prometheus.port=3000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - ./monitoring/prometheus-alerts.yaml:/etc/prometheus/rules/mcp-alerts.yaml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - ./monitoring/grafana-dashboard.json:/var/lib/grafana/dashboards/mcp.json
```

## Troubleshooting

### Metrics Not Appearing

1. Check endpoint: `curl http://localhost:3000/metrics`
2. Verify Prometheus scrape config
3. Check firewall/network policies

### Health Check Failures

1. Check logs: `docker logs mcp-server`
2. Verify connector credentials
3. Check network connectivity to dependencies

### High Latency

1. Check tool-specific metrics
2. Review connector health
3. Monitor resource usage (CPU, memory)
4. Check for connection pool exhaustion
