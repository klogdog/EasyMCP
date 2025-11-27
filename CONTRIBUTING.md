# Contributing to EasyMCP

Thank you for your interest in contributing to EasyMCP! This document provides guidelines and instructions for contributing.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Setup](#development-setup)
4. [Coding Standards](#coding-standards)
5. [Pull Request Process](#pull-request-process)
6. [Testing Requirements](#testing-requirements)
7. [Documentation](#documentation)
8. [Issue Guidelines](#issue-guidelines)

---

## Code of Conduct

Please be respectful and considerate in all interactions. We welcome contributions from everyone regardless of experience level, gender, gender identity, sexual orientation, disability, personal appearance, body size, race, ethnicity, age, religion, or nationality.

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker 20.10+
- Git

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/EasyMCP.git
   cd EasyMCP
   ```
3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/klogdog/EasyMCP.git
   ```

---

## Development Setup

### Using Dev Container (Recommended)

1. Install VS Code and the Dev Containers extension
2. Open the project in VS Code
3. Click "Reopen in Container" when prompted
4. The container includes all necessary dependencies

### Manual Setup

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Start development mode
npm run dev
```

### Available Scripts

| Script                  | Description                |
| ----------------------- | -------------------------- |
| `npm run build`         | Compile TypeScript         |
| `npm run dev`           | Watch mode compilation     |
| `npm test`              | Run tests                  |
| `npm run test:watch`    | Run tests in watch mode    |
| `npm run test:coverage` | Run tests with coverage    |
| `npm run lint`          | Run ESLint                 |
| `npm run format`        | Format code with Prettier  |
| `npm run docs`          | Generate API documentation |

---

## Coding Standards

### TypeScript Style

We follow these TypeScript conventions:

```typescript
// ✅ Use explicit types for function parameters and returns
export async function processData(input: DataInput): Promise<DataOutput> {
  // Implementation
}

// ✅ Use interfaces for object shapes
export interface ToolMetadata {
  name: string;
  description: string;
  version: string;
}

// ✅ Use meaningful variable names
const userConfiguration = loadConfig();
// ❌ Avoid unclear abbreviations
const cfg = loadConfig();

// ✅ Use const for values that don't change
const MAX_RETRIES = 3;

// ✅ Document exported functions
/**
 * Loads and parses the configuration file.
 *
 * @param path - Path to the configuration file
 * @returns Parsed configuration object
 * @throws ConfigError if file cannot be read or parsed
 */
export function loadConfig(path: string): Config {
  // Implementation
}
```

### File Organization

```
base/
├── feature.ts           # Main feature implementation
├── feature.test.ts      # Tests for the feature
└── feature.types.ts     # Types (if separate file needed)
```

### Naming Conventions

| Type       | Convention       | Example            |
| ---------- | ---------------- | ------------------ |
| Files      | kebab-case       | `config-parser.ts` |
| Classes    | PascalCase       | `ConfigParser`     |
| Interfaces | PascalCase       | `ConfigOptions`    |
| Functions  | camelCase        | `parseConfig`      |
| Constants  | UPPER_SNAKE_CASE | `MAX_RETRIES`      |
| Variables  | camelCase        | `configValue`      |

### Comments and Documentation

````typescript
/**
 * Short description of what the function does.
 *
 * Longer description if needed, explaining the behavior,
 * edge cases, or important implementation details.
 *
 * @param paramName - Description of the parameter
 * @returns Description of the return value
 * @throws ErrorType - When this error is thrown
 *
 * @example
 * ```typescript
 * const result = myFunction({ key: 'value' });
 * console.log(result);
 * ```
 */
export function myFunction(paramName: ParamType): ReturnType {
  // Implementation
}
````

---

## Pull Request Process

### Before Submitting

1. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Keep commits focused**
   - Each commit should represent one logical change
   - Write clear commit messages

3. **Run all checks**

   ```bash
   npm run lint
   npm run format:check
   npm test
   npm run build
   ```

4. **Update documentation**
   - Update README if adding user-facing features
   - Add JSDoc comments for new public APIs
   - Update relevant docs/ files

### Submitting a PR

1. Push your branch to your fork
2. Open a Pull Request against `main`
3. Fill out the PR template completely
4. Link any related issues

### PR Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

Describe testing done

## Checklist

- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### Review Process

1. Maintainers will review your PR
2. Address any feedback
3. Once approved, a maintainer will merge

---

## Testing Requirements

### Test Coverage

- All new features must include tests
- Bug fixes should include regression tests
- Aim for >80% coverage on new code

### Writing Tests

```typescript
import { describe, it, expect, beforeEach } from "@jest/globals";
import { myFunction } from "./my-module";

describe("myFunction", () => {
  describe("when given valid input", () => {
    it("should return expected output", () => {
      const result = myFunction({ key: "value" });
      expect(result).toEqual({ processed: true });
    });
  });

  describe("when given invalid input", () => {
    it("should throw ValidationError", () => {
      expect(() => myFunction(null)).toThrow("Invalid input");
    });
  });
});
```

### Test File Location

- Unit tests: `base/__tests__/module.test.ts`
- Or co-located: `base/module.test.ts`

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- path/to/test.ts

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

---

## Documentation

### Types of Documentation

1. **Code Comments** - JSDoc for public APIs
2. **README.md** - Quick start and overview
3. **docs/** - Detailed guides
4. **API Docs** - Generated from JSDoc

### Generating API Docs

```bash
# Generate documentation
npm run docs

# View at docs/api/index.html
```

### Writing Documentation

- Use clear, simple language
- Include code examples
- Keep examples tested and working
- Update when code changes

---

## Issue Guidelines

### Bug Reports

Include:

- Node.js and Docker versions
- Steps to reproduce
- Expected vs actual behavior
- Error messages/logs
- Minimal reproduction if possible

### Feature Requests

Include:

- Use case description
- Proposed solution
- Alternative solutions considered
- Willingness to implement

### Issue Labels

| Label              | Description               |
| ------------------ | ------------------------- |
| `bug`              | Something isn't working   |
| `enhancement`      | New feature request       |
| `documentation`    | Documentation improvement |
| `good first issue` | Good for newcomers        |
| `help wanted`      | Extra attention needed    |

---

## Questions?

- Open an issue with the `question` label
- Check existing issues and documentation
- Join discussions in GitHub Discussions

---

Thank you for contributing to EasyMCP! 🎉
