# Devcontainer base image with Node.js, Python, TypeScript, and Docker-in-Docker support
FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Install Node.js LTS
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y nodejs

# Install Python
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    python3.11-venv \
    && rm -rf /var/lib/apt/lists/*

# Install TypeScript and ts-node globally
RUN npm install -g typescript ts-node

# Create workspace directory
RUN mkdir -p /workspace/tools /workspace/connectors /workspace/config

# Set working directory
WORKDIR /workspace

# Setup non-root user
ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID

# Ensure vscode user exists with correct permissions
RUN groupadd --gid $USER_GID $USERNAME || true \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME || true \
    && chown -R $USERNAME:$USERNAME /workspace

USER $USERNAME
