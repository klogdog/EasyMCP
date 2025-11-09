# Production Dockerfile for MCP Server Generator
# This is the application container that will build other MCP servers

# Use Alpine Linux for minimal image size
FROM node:20-alpine

# Install Docker CLI for Docker-in-Docker operations
# --no-cache keeps the image size small by not storing the package index
RUN apk add --no-cache docker-cli

# Set working directory for the application
WORKDIR /app

# Copy package files first for better layer caching
# This allows Docker to reuse the dependency layer if package.json hasn't changed
COPY package*.json ./

# Install production dependencies only
# npm ci provides reproducible builds and is faster than npm install
RUN npm ci --only=production

# Copy compiled TypeScript output
# Note: Run 'npm run build' before building the Docker image
COPY dist/ ./dist/

# Create volume mount points for runtime configuration
# These directories will hold user-provided tools, connectors, and configs
RUN mkdir -p /app/tools /app/connectors /app/config /app/templates

# Set production environment
ENV NODE_ENV=production

# Set the entry point to run the compiled application
ENTRYPOINT ["node", "dist/main.js"]

# Default command is "build" but can be overridden
# Usage: docker run mcp-generator         (runs build)
#        docker run mcp-generator serve   (runs serve)
CMD ["build"]
