# Task 8.1: Create CLI Interface

**Goal**: Build user-friendly command-line interface for the generator.

**Actions**:

- Create `base/cli.ts` using commander.js: `const program = new Command()`
- Add version flag: `-v, --version` reads from package.json
- Add help documentation: `-h, --help` with examples and common usage patterns
- Implement verbosity control: `-q` (quiet), default, `-v` (verbose), `-vv` (debug)
- Add commands: `build` (generate MCP server), `run` (build and start), `list-tools` (show discovered modules), `validate` (check modules)
- Include global options: `--config <path>`, `--tools-dir <path>`, `--connectors-dir <path>`, `--no-cache`
- Add colorized output: use chalk for success (green), errors (red), warnings (yellow), info (blue)
- Implement command aliases: `b` for build, `r` for run

**Success Criteria**: User-friendly CLI; clear help text; colorized output; supports common patterns; good error messages
