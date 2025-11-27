# EasyMCP - MCP Server Generator

A Docker-native MCP (Model Context Protocol) server factory that automatically builds, configures, and deploys MCP servers from your tools and connectors.

[![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)](https://docker.com)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 🚀 Quick Start

Get a working MCP server in under 5 minutes!

### Prerequisites

- **Docker** 20.10+ ([Install Docker](https://docs.docker.com/get-docker/))
- **Node.js** 20+ ([Install Node.js](https://nodejs.org/))
- **Git** ([Install Git](https://git-scm.com/))

### Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/klogdog/EasyMCP.git
cd EasyMCP

# Install dependencies
npm install

# Build the TypeScript code
npm run build
```

### Step 2: Build the Generator Image

```bash
# Build the MCP generator Docker image
docker build -t mcp-generator .
```

### Step 3: Generate Your MCP Server

```bash
# Run the generator (interactive mode)
docker run -it \
  --privileged \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(pwd)/tools:/app/tools \
  -v $(pwd)/connectors:/app/connectors \
  -v $(pwd)/config:/app/config \
  mcp-generator build

# Expected output:
# ✔ Scanning /app/tools... Found 4 tools
# ✔ Scanning /app/connectors... Found 2 connectors
# ✔ Generating MCP manifest...
# ✔ Building Docker image: mcp-server:latest
# ✔ Done! Your MCP server is ready.
```

### Step 4: Run Your MCP Server

```bash
# Run the generated MCP server
docker run -d \
  -p 8080:8080 \
  -e DATABASE_URL="sqlite:./data/mcp.db" \
  -e OPENAI_API_KEY="sk-your-key" \
  mcp-server:latest

# Test the server
curl http://localhost:8080/health
# {"status":"ok","version":"1.0.0"}
```

### Step 5: Test with MCP Client

```bash
# List available tools
curl http://localhost:8080/tools
# {"tools":["summarize","classify","translate","calculator"]}

# Call a tool
curl -X POST http://localhost:8080/tools/summarize \
  -H "Content-Type: application/json" \
  -d '{"text":"Your long text here...","maxLength":100}'
```

---

## 📖 What's Next?

Now that you have your first MCP server running, explore these guides:

| Guide                                                  | Description                                            |
| ------------------------------------------------------ | ------------------------------------------------------ |
| [Tool Development](docs/tool-development.md)           | Create custom tools with validation and best practices |
| [Connector Development](docs/connector-development.md) | Build connectors for external services                 |
| [Configuration](docs/configuration.md)                 | Configure database, logging, and features              |
| [Deployment](docs/deployment.md)                       | Deploy to Docker, Kubernetes, or cloud                 |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Generator (Docker)                        │
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────┐ │
│  │  Loader  │ → │ Manifest │ → │ Config   │ → │  Dockerizer  │ │
│  │          │   │ Generator│   │ Generator│   │              │ │
│  └──────────┘   └──────────┘   └──────────┘   └──────────────┘ │
│       ↑              ↑                              ↓           │
│  ┌─────────┐    ┌──────────┐                 ┌──────────────┐  │
│  │ /tools  │    │/connectors│                │ MCP Server   │  │
│  │         │    │          │                 │ Docker Image │  │
│  └─────────┘    └──────────┘                 └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
              ┌───────────────────────────────┐
              │     Generated MCP Server      │
              │  ┌─────────────────────────┐ │
              │  │ Tools: summarize,       │ │
              │  │   classify, translate   │ │
              │  ├─────────────────────────┤ │
              │  │ Connectors: gmail,      │ │
              │  │   notion, database      │ │
              │  ├─────────────────────────┤ │
              │  │ Config: config.yaml     │ │
              │  └─────────────────────────┘ │
              └───────────────────────────────┘
```

---

## 🔧 Common Usage Examples

### Build with Custom Tools

```bash
# Add your custom tool
cat > tools/my-tool.ts << 'EOF'
export const metadata = {
    name: 'my-tool',
    description: 'My custom tool',
    schemaVersion: '1.0',
    version: '1.0.0'
};

export async function handler(input: { text: string }) {
    return { result: input.text.toUpperCase() };
}
EOF

# Rebuild the server
docker run -it \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(pwd)/tools:/app/tools \
  mcp-generator build
```

### Run Server Locally (Development)

```bash
# Start in development mode
npm run dev

# Or with specific config
NODE_ENV=development npm start
```

### Test with curl

```bash
# Health check
curl http://localhost:8080/health

# List tools
curl http://localhost:8080/tools

# Call summarize tool
curl -X POST http://localhost:8080/tools/summarize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is a very long text that needs to be summarized...",
    "maxLength": 50,
    "style": "paragraph"
  }'

# Call classify tool
curl -X POST http://localhost:8080/tools/classify \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I love this product! Amazing quality!",
    "categories": ["positive", "negative", "neutral"]
  }'
```

---

## ❓ Troubleshooting FAQ

### Docker not running

```bash
# Check Docker status
docker info

# Start Docker (Linux)
sudo systemctl start docker

# Start Docker (Mac)
open -a Docker
```

### Permission denied on Docker socket

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Or run with sudo
sudo docker run ...
```

### Port already in use

```bash
# Find process using port
lsof -i :8080

# Use different port
docker run -p 3000:8080 mcp-server:latest
```

### Module not found

```bash
# Rebuild TypeScript
npm run build

# Clear node_modules
rm -rf node_modules && npm install
```

### Environment variable not set

```bash
# Check if set
echo $DATABASE_URL

# Set for current session
export DATABASE_URL="postgres://..."

# Or use .env file
echo 'DATABASE_URL=postgres://...' >> .env
```

---

## 📁 Project Structure

```
EasyMCP/
├── base/                    # Core generator code
│   ├── loader.ts           # Tool/connector discovery
│   ├── generator.ts        # Manifest generation
│   ├── dockerizer.ts       # Docker image builder
│   ├── config-generator.ts # Config file generator
│   ├── prompt.ts           # Interactive prompts
│   └── templates/          # Server templates
│
├── tools/                   # Drop-in tool modules
│   ├── summarize.ts        # Text summarization
│   ├── classify.ts         # Text classification
│   ├── translate.ts        # Translation
│   └── calculator.py       # Math operations
│
├── connectors/              # Drop-in connectors
│   ├── gmail.ts            # Gmail API
│   ├── notion.ts           # Notion API
│   └── database-connector.py
│
├── config/                  # Configuration files
│   ├── config.yaml         # Main config
│   ├── config.dev.yaml     # Development overrides
│   └── config.prod.yaml    # Production overrides
│
├── docs/                    # Documentation
│   ├── tool-development.md
│   ├── connector-development.md
│   ├── configuration.md
│   └── deployment.md
│
├── .devcontainer/           # VS Code dev container
├── Dockerfile               # Generator image
└── package.json
```

---

## 🔄 How It Works

### 1. Tool & Connector Discovery

The generator scans `/tools` and `/connectors` for TypeScript (`.ts`) and Python (`.py`) files:

```bash
✔ Scanning /app/tools... Found 4 tools
  - summarize.ts
  - classify.ts
  - translate.ts
  - calculator.py
✔ Scanning /app/connectors... Found 2 connectors
  - gmail.ts
  - notion.ts
```

### 2. Credential Prompts

Interactive credential collection (or from environment):

```
? Enter database URL: postgresql://user:password@db:5432/appdb
? Enter OpenAI API key: sk-...
? Enter Notion token: secret_...
```

### 3. Configuration Generation

Creates `config.yaml` with collected settings:

```yaml
server:
  name: mcp-server
  version: 1.0.0
  port: 8080

database:
  url: ${DATABASE_URL}

services:
  openai:
    apiKey: ${OPENAI_API_KEY}

connectors:
  gmail:
    enabled: true
  notion:
    enabled: true
```

### 4. Docker Image Build

Builds a self-contained MCP server image:

```
Step 1/8 : FROM node:20-alpine
Step 2/8 : WORKDIR /app
Step 3/8 : COPY package*.json ./
...
Successfully built abc123def
Successfully tagged mcp-server:latest
```

---

## 🛠️ Development Setup

### Using Dev Container (Recommended)

1. Install [VS Code](https://code.visualstudio.com/)
2. Install [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
3. Open project in VS Code
4. Click "Reopen in Container" when prompted

### Manual Setup

```bash
# Clone repository
git clone https://github.com/klogdog/EasyMCP.git
cd EasyMCP

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Start development server
npm run dev
```

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) - The MCP specification
- [Docker](https://docker.com) - Containerization platform
- [Node.js](https://nodejs.org) - JavaScript runtime

---

<p align="center">
  <strong>Built with ❤️ for the MCP community</strong>
</p>
