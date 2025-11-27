# Deployment Guide

A comprehensive guide to deploying EasyMCP servers in various environments.

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Docker Deployment](#docker-deployment)
3. [Kubernetes Deployment](#kubernetes-deployment)
4. [Registry Setup](#registry-setup)
5. [Production Considerations](#production-considerations)
6. [Environment Variables](#environment-variables)
7. [Networking](#networking)
8. [High Availability](#high-availability)
9. [Monitoring](#monitoring)
10. [Backup and Restore](#backup-and-restore)

---

## Deployment Overview

### Deployment Methods

| Method | Best For | Complexity |
|--------|----------|------------|
| Docker | Single server, development | Low |
| Docker Compose | Multi-container, staging | Medium |
| Kubernetes | Production, scaling | High |
| Cloud Run/Fargate | Serverless, auto-scaling | Medium |

### Prerequisites

- Docker 20.10+ installed
- Access to container registry (Docker Hub, GHCR, etc.)
- Environment variables configured
- TLS certificates (for production)

---

## Docker Deployment

### Basic Docker Run

```bash
# Pull the image
docker pull yourusername/mcp-server:latest

# Run with basic configuration
docker run -d \
  --name mcp-server \
  -p 8080:8080 \
  -e DATABASE_URL="postgres://user:pass@host:5432/db" \
  -e OPENAI_API_KEY="sk-..." \
  yourusername/mcp-server:latest
```

### Docker Run with Volume Mounts

```bash
# Run with custom tools and configuration
docker run -d \
  --name mcp-server \
  -p 8080:8080 \
  -v $(pwd)/config:/app/config:ro \
  -v $(pwd)/tools:/app/tools:ro \
  -v $(pwd)/connectors:/app/connectors:ro \
  -v $(pwd)/data:/app/data \
  -e DATABASE_URL="postgres://user:pass@host:5432/db" \
  -e NODE_ENV=production \
  yourusername/mcp-server:latest
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  mcp-server:
    image: yourusername/mcp-server:latest
    container_name: mcp-server
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - PORT=8080
      - DATABASE_URL=postgres://postgres:password@db:5432/mcp
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - LOG_LEVEL=info
    volumes:
      - ./config:/app/config:ro
      - ./tools:/app/tools:ro
      - ./connectors:/app/connectors:ro
      - mcp-data:/app/data
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - mcp-network

  db:
    image: postgres:15-alpine
    container_name: mcp-db
    restart: unless-stopped
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=mcp
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - mcp-network

  redis:
    image: redis:7-alpine
    container_name: mcp-redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    networks:
      - mcp-network

volumes:
  mcp-data:
  postgres-data:
  redis-data:

networks:
  mcp-network:
    driver: bridge
```

Run with:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f mcp-server

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Production Docker Compose

```yaml
version: '3.8'

services:
  mcp-server:
    image: yourusername/mcp-server:${VERSION:-latest}
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
        order: start-first
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## Kubernetes Deployment

### Deployment Manifest

Create `k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-server
  namespace: mcp
  labels:
    app: mcp-server
    version: v1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-server
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: mcp-server
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: mcp-server
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
      - name: mcp-server
        image: yourusername/mcp-server:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 8080
          name: http
          protocol: TCP
        envFrom:
        - configMapRef:
            name: mcp-config
        - secretRef:
            name: mcp-secrets
        resources:
          requests:
            cpu: 250m
            memory: 256Mi
          limits:
            cpu: 1000m
            memory: 1Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        volumeMounts:
        - name: config
          mountPath: /app/config
          readOnly: true
        - name: data
          mountPath: /app/data
      volumes:
      - name: config
        configMap:
          name: mcp-server-config
      - name: data
        persistentVolumeClaim:
          claimName: mcp-data
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchLabels:
                  app: mcp-server
              topologyKey: kubernetes.io/hostname
```

### Service Manifest

Create `k8s/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mcp-server
  namespace: mcp
  labels:
    app: mcp-server
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 8080
    protocol: TCP
    name: http
  selector:
    app: mcp-server
---
# Headless service for StatefulSet (if needed)
apiVersion: v1
kind: Service
metadata:
  name: mcp-server-headless
  namespace: mcp
spec:
  type: ClusterIP
  clusterIP: None
  ports:
  - port: 8080
    name: http
  selector:
    app: mcp-server
```

### ConfigMap

Create `k8s/configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mcp-config
  namespace: mcp
data:
  NODE_ENV: "production"
  PORT: "8080"
  LOG_LEVEL: "info"
  LOG_FORMAT: "json"
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: mcp-server-config
  namespace: mcp
data:
  config.yaml: |
    server:
      name: mcp-server
      version: 1.0.0
      host: 0.0.0.0
      port: 8080
    
    logging:
      level: info
      format: json
      destination: stdout
    
    features:
      add: true
      subtract: true
      multiply: true
      divide: true
```

### Secret Manifest

Create `k8s/secret.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mcp-secrets
  namespace: mcp
type: Opaque
stringData:
  DATABASE_URL: "postgres://user:password@postgres:5432/mcp"
  OPENAI_API_KEY: "sk-..."
  REDIS_URL: "redis://redis:6379"
```

> ⚠️ **Security Note**: In production, use external secret management (Vault, AWS Secrets Manager, etc.) instead of storing secrets in manifests.

### Ingress

Create `k8s/ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mcp-server
  namespace: mcp
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
spec:
  tls:
  - hosts:
    - mcp.example.com
    secretName: mcp-tls
  rules:
  - host: mcp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: mcp-server
            port:
              number: 80
```

### Horizontal Pod Autoscaler

Create `k8s/hpa.yaml`:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: mcp-server
  namespace: mcp
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: mcp-server
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Pods
        value: 1
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Pods
        value: 2
        periodSeconds: 60
```

### Apply All Manifests

```bash
# Create namespace
kubectl create namespace mcp

# Apply manifests
kubectl apply -f k8s/

# Or apply individually
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml

# Check status
kubectl -n mcp get pods
kubectl -n mcp get svc
kubectl -n mcp describe deployment mcp-server
```

---

## Registry Setup

### Docker Hub

```bash
# Login to Docker Hub
docker login

# Tag your image
docker tag mcp-server:latest yourusername/mcp-server:latest
docker tag mcp-server:latest yourusername/mcp-server:v1.0.0

# Push to registry
docker push yourusername/mcp-server:latest
docker push yourusername/mcp-server:v1.0.0
```

### GitHub Container Registry (GHCR)

```bash
# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Tag your image
docker tag mcp-server:latest ghcr.io/yourusername/mcp-server:latest

# Push to registry
docker push ghcr.io/yourusername/mcp-server:latest
```

### Private Registry

```bash
# Login to private registry
docker login registry.example.com

# Tag and push
docker tag mcp-server:latest registry.example.com/mcp/mcp-server:latest
docker push registry.example.com/mcp/mcp-server:latest
```

### Registry Authentication in Kubernetes

```yaml
# Create registry secret
apiVersion: v1
kind: Secret
metadata:
  name: registry-credentials
  namespace: mcp
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: <base64-encoded-docker-config>

# Reference in deployment
spec:
  imagePullSecrets:
  - name: registry-credentials
```

```bash
# Create secret from command line
kubectl create secret docker-registry registry-credentials \
  --docker-server=registry.example.com \
  --docker-username=user \
  --docker-password=password \
  --namespace=mcp
```

---

## Production Considerations

### Resource Limits

```yaml
# Kubernetes
resources:
  requests:
    cpu: 250m      # 0.25 CPU cores
    memory: 256Mi  # 256 MB RAM
  limits:
    cpu: 1000m     # 1 CPU core
    memory: 1Gi    # 1 GB RAM

# Docker Compose
deploy:
  resources:
    limits:
      cpus: '1'
      memory: 1G
    reservations:
      cpus: '0.25'
      memory: 256M
```

### Health Checks

```yaml
# Kubernetes probes
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3

startupProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 10
  failureThreshold: 30
```

### Logging Best Practices

```yaml
# JSON logging for aggregation
logging:
  level: info
  format: json
  destination: stdout

# Log fields to include
# {
#   "timestamp": "2024-01-15T10:30:00.000Z",
#   "level": "info",
#   "message": "Request processed",
#   "requestId": "abc-123",
#   "duration": 45,
#   "status": 200
# }
```

### Scaling Guidelines

| Load Level | Replicas | CPU (per pod) | Memory (per pod) |
|------------|----------|---------------|------------------|
| Development | 1 | 250m | 256Mi |
| Low | 2-3 | 500m | 512Mi |
| Medium | 3-5 | 1000m | 1Gi |
| High | 5-10 | 2000m | 2Gi |
| Very High | 10+ | 2000m | 4Gi |

---

## Environment Variables

### Injecting Secrets

#### Docker

```bash
# From file
docker run --env-file .env.production mcp-server

# From command line
docker run \
  -e DATABASE_URL="$DATABASE_URL" \
  -e OPENAI_API_KEY="$OPENAI_API_KEY" \
  mcp-server
```

#### Kubernetes Secrets

```yaml
# From Secret
envFrom:
- secretRef:
    name: mcp-secrets

# Individual keys
env:
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: mcp-secrets
      key: DATABASE_URL
```

#### AWS Parameter Store

```yaml
# Using external-secrets operator
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: mcp-secrets
  namespace: mcp
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-parameter-store
    kind: ClusterSecretStore
  target:
    name: mcp-secrets
  data:
  - secretKey: DATABASE_URL
    remoteRef:
      key: /mcp/production/database-url
  - secretKey: OPENAI_API_KEY
    remoteRef:
      key: /mcp/production/openai-api-key
```

#### HashiCorp Vault

```yaml
# Using vault-agent injector
metadata:
  annotations:
    vault.hashicorp.com/agent-inject: "true"
    vault.hashicorp.com/role: "mcp-server"
    vault.hashicorp.com/agent-inject-secret-config: "secret/mcp/config"
    vault.hashicorp.com/agent-inject-template-config: |
      {{- with secret "secret/mcp/config" -}}
      export DATABASE_URL="{{ .Data.data.database_url }}"
      export OPENAI_API_KEY="{{ .Data.data.openai_api_key }}"
      {{- end }}
```

---

## Networking

### Reverse Proxy with Nginx

```nginx
# /etc/nginx/conf.d/mcp.conf
upstream mcp_backend {
    least_conn;
    server mcp-server-1:8080 weight=1;
    server mcp-server-2:8080 weight=1;
    server mcp-server-3:8080 weight=1;
    keepalive 32;
}

server {
    listen 80;
    server_name mcp.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mcp.example.com;

    ssl_certificate /etc/ssl/certs/mcp.crt;
    ssl_certificate_key /etc/ssl/private/mcp.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    location / {
        proxy_pass http://mcp_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    location /health {
        proxy_pass http://mcp_backend/health;
        access_log off;
    }
}
```

### Traefik Configuration

```yaml
# docker-compose with Traefik
services:
  traefik:
    image: traefik:v2.10
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=admin@example.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt

  mcp-server:
    image: yourusername/mcp-server:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.mcp.rule=Host(`mcp.example.com`)"
      - "traefik.http.routers.mcp.entrypoints=websecure"
      - "traefik.http.routers.mcp.tls.certresolver=letsencrypt"
      - "traefik.http.services.mcp.loadbalancer.server.port=8080"
```

### SSL/TLS Termination

```bash
# Generate self-signed certificate (development)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout mcp.key \
  -out mcp.crt \
  -subj "/CN=mcp.example.com"

# Using Let's Encrypt with certbot
certbot certonly --standalone -d mcp.example.com
```

### Load Balancing Strategies

| Strategy | Description | Use Case |
|----------|-------------|----------|
| Round Robin | Rotate through servers | Default, equal load |
| Least Connections | Send to least busy | Variable request duration |
| IP Hash | Same client → same server | Session affinity |
| Weighted | Prioritize by weight | Unequal server capacity |

---

## High Availability

### Multi-Replica Deployment

```yaml
# Kubernetes
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0

# Pod anti-affinity to spread across nodes
affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
    - labelSelector:
        matchLabels:
          app: mcp-server
      topologyKey: kubernetes.io/hostname
```

### Rolling Updates

```yaml
# Kubernetes rolling update
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1        # Extra pods during update
    maxUnavailable: 0  # Always maintain capacity
```

```bash
# Trigger rolling update
kubectl set image deployment/mcp-server \
  mcp-server=yourusername/mcp-server:v1.1.0 \
  --record

# Check rollout status
kubectl rollout status deployment/mcp-server

# Rollback if needed
kubectl rollout undo deployment/mcp-server
```

### Zero-Downtime Deploys

```yaml
# Ensure readiness probe passes before receiving traffic
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5

# Graceful shutdown
spec:
  terminationGracePeriodSeconds: 60
  containers:
  - name: mcp-server
    lifecycle:
      preStop:
        exec:
          command: ["/bin/sh", "-c", "sleep 10"]
```

### Database High Availability

```yaml
# PostgreSQL with replication
services:
  postgres-primary:
    image: postgres:15
    environment:
      - POSTGRES_REPLICATION_MODE=master
      - POSTGRES_REPLICATION_USER=repl_user
      - POSTGRES_REPLICATION_PASSWORD=repl_password

  postgres-replica:
    image: postgres:15
    environment:
      - POSTGRES_REPLICATION_MODE=slave
      - POSTGRES_MASTER_HOST=postgres-primary
      - POSTGRES_MASTER_PORT=5432
      - POSTGRES_REPLICATION_USER=repl_user
      - POSTGRES_REPLICATION_PASSWORD=repl_password
```

---

## Monitoring

### Prometheus Metrics

```yaml
# Prometheus scrape config
scrape_configs:
  - job_name: 'mcp-server'
    kubernetes_sd_configs:
    - role: pod
    relabel_configs:
    - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
      action: keep
      regex: true
    - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
      action: replace
      target_label: __metrics_path__
      regex: (.+)
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "MCP Server Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{app=\"mcp-server\"}[5m])",
            "legendFormat": "{{method}} {{path}}"
          }
        ]
      },
      {
        "title": "Response Time (p99)",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{app=\"mcp-server\"}[5m]))",
            "legendFormat": "p99 latency"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{app=\"mcp-server\",status=~\"5..\"}[5m])",
            "legendFormat": "5xx errors"
          }
        ]
      }
    ]
  }
}
```

### Log Aggregation with ELK

```yaml
# Filebeat sidecar
containers:
- name: filebeat
  image: elastic/filebeat:8.10.0
  volumeMounts:
  - name: logs
    mountPath: /var/log/mcp
  - name: filebeat-config
    mountPath: /usr/share/filebeat/filebeat.yml
    subPath: filebeat.yml
```

### Alerting Rules

```yaml
# Prometheus alerting rules
groups:
- name: mcp-server
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{app="mcp-server",status=~"5.."}[5m]) > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate on MCP server"
      description: "Error rate is {{ $value }} errors/sec"

  - alert: HighLatency
    expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{app="mcp-server"}[5m])) > 2
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High latency on MCP server"
      description: "p99 latency is {{ $value }}s"

  - alert: PodNotReady
    expr: kube_pod_status_ready{namespace="mcp",pod=~"mcp-server.*"} == 0
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "MCP server pod not ready"
```

---

## Backup and Restore

### Database Backup

```bash
#!/bin/bash
# backup-db.sh

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/mcp_backup_${TIMESTAMP}.sql.gz"

# PostgreSQL backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > $BACKUP_FILE

# Upload to S3
aws s3 cp $BACKUP_FILE s3://mcp-backups/database/

# Cleanup old backups (keep last 7 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
```

### Kubernetes CronJob for Backups

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: mcp-backup
  namespace: mcp
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:15
            command:
            - /bin/sh
            - -c
            - |
              pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | \
              gzip | \
              aws s3 cp - s3://mcp-backups/database/backup_$(date +%Y%m%d).sql.gz
            envFrom:
            - secretRef:
                name: mcp-backup-secrets
          restartPolicy: OnFailure
```

### Restore Procedure

```bash
#!/bin/bash
# restore-db.sh

# Download backup
aws s3 cp s3://mcp-backups/database/backup_20240115.sql.gz /tmp/

# Restore
gunzip -c /tmp/backup_20240115.sql.gz | \
  psql -h $DB_HOST -U $DB_USER -d $DB_NAME

echo "Restore completed"
```

### Configuration Backup

```bash
# Backup all configuration
kubectl get configmap mcp-config -n mcp -o yaml > mcp-config-backup.yaml
kubectl get secret mcp-secrets -n mcp -o yaml > mcp-secrets-backup.yaml
kubectl get deployment mcp-server -n mcp -o yaml > mcp-deployment-backup.yaml
```

---

## Next Steps

- [Tool Development Guide](./tool-development.md) - Create custom tools
- [Connector Development Guide](./connector-development.md) - Build connectors
- [Configuration Guide](./configuration.md) - Configure your deployment
- [API Documentation](./api/index.html) - Full API reference
