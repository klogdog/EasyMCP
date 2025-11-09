# Task 1.2: Configure Package Management

**Goal**: Set up Node.js/TypeScript project configuration with all necessary dependencies.

**Actions**:

- Create `package.json`: name="mcp-generator", version="0.1.0", main="dist/main.js", scripts for build/test
- Add dependencies: `typescript`, `@types/node`, `dockerode` (Docker SDK), `inquirer` (interactive prompts), `js-yaml` (YAML parsing), `zod` (schema validation)
- Add devDependencies: `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `prettier`, `@types/inquirer`, `@types/js-yaml`
- Create `tsconfig.json`: target ES2020, module commonjs, outDir "./dist", strict mode enabled, esModuleInterop true

**Success Criteria**: `npm install` runs successfully; TypeScript compiles without errors
