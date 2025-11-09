# Task 13.3: Create Pre-commit Hooks

**Goal**: Enforce code quality and standards before commits.

**Actions**:

- Install husky and lint-staged: `npm install --save-dev husky lint-staged`
- Configure husky: run `npx husky init`, create pre-commit hook that runs lint-staged
- Set up lint-staged in package.json: run ESLint on \*.ts files, Prettier on all files, type checking
- Add code formatting checks: ensure all files formatted with Prettier, auto-fix if possible
- Implement linting: run ESLint with --max-warnings 0, enforce coding standards
- Add commit message validation: use commitlint, enforce conventional commits format (feat:, fix:, docs:)
- Include security checks: run npm audit, block commits if vulnerabilities found (configurable severity)
- Add test running: run affected tests for changed files (optional, can be slow)
- Create bypass option: allow `--no-verify` for emergencies, document when appropriate
- Add documentation checks: verify JSDoc comments present for public functions
- Document pre-commit setup: how to install hooks, what checks run, how to configure

**Success Criteria**: Pre-commit hooks installed; format/lint checks run; commit messages validated; security checked; documented
