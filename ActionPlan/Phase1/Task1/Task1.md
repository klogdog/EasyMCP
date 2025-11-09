# Task 1.1: Initialize Project Structure

**Goal**: Set up the foundational directory structure for the MCP server generator project.

**Actions**:

- Create directories: `/base` (generator code), `/tools` (drop-in MCP tools), `/connectors` (API integrations), `/config` (runtime configs), `/templates` (code generation templates)
- Add README.md in each directory: explain purpose, expected file formats, and naming conventions
- Create `.gitignore`: exclude `node_modules/`, `dist/`, `*.log`, `.env`, `*.img`, Docker build artifacts

**Success Criteria**: All directories exist with descriptive READMEs; git ignores build artifacts
