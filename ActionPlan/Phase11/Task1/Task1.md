# Task 11.1: Add Multi-Language Support

**Goal**: Enable tools and connectors written in Python alongside TypeScript.

**Actions**:

- Extend `loader.ts`: add Python file handling, parse Python docstrings for metadata using regex or python-ast
- Update Dockerfile generator: detect if Python modules present, add Python runtime to generated image
- Add Python requirements: scan Python files for imports, generate requirements.txt, pip install in Dockerfile
- Implement language-agnostic invocation: for Python tools, spawn child process or use Python bridge library
- Add polyglot dependency management: separate npm packages and pip packages, install both in generated server
- Create Python tool template: example Python tool with proper metadata format in docstring
- Update tool-loader template: handle both .js and .py module imports, route to appropriate executor
- Include mixed-language example: one TypeScript tool, one Python tool in same MCP server
- Document in tool development guide: how to write Python tools, metadata format differences

**Success Criteria**: Loads Python modules; generates images with both runtimes; executes Python tools; example working
