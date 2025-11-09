# Task 15.1: Create Demo Project

**Goal**: Build comprehensive demonstration of MCP generator capabilities.

**Actions**:

- Create `examples/demo-workspace/` directory structure with tools/, connectors/, config/
- Build variety of tools: text-summarizer (simple), code-analyzer (complex), image-processor (multi-step)
- Include connectors: Gmail (OAuth), Notion (token auth), PostgreSQL (database), Slack (webhooks)
- Add demo configuration: config.demo.yaml with sample settings, environment variable examples, comments
- Create demo deployment script: `demo.sh` that builds server, starts container, runs sample requests, shows output
- Add sample data: test emails, documents, database schema for realistic demo
- Create interactive demo: CLI that lets users try different tools, see results in real-time
- Record demo video: screen capture showing build process, server startup, tool invocation, results
- Take screenshots: architecture diagram, terminal output, generated Dockerfile, running server
- Add demo documentation: README in examples/ explaining what each component demonstrates
- Include performance demo: show scaling, concurrent requests, metrics dashboard

**Success Criteria**: Comprehensive demo workspace; multiple tools/connectors; deployment script works; video/screenshots ready; documented
