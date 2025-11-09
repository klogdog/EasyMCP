# Task 3.1: Create Interactive Prompt System

**Goal**: Build user-friendly CLI prompts for collecting credentials and configuration.

**Actions**:

- Create `base/prompt.ts` using inquirer library
- Export `async function promptForCredentials(requirements: CredentialRequirement[]): Promise<Record<string, string>>`
- For each requirement, create appropriate prompt type: input (text), password (masked), confirm (yes/no), list (dropdown)
- Add validation callbacks: email format, URL format, non-empty strings, numeric ranges
- Implement conditional prompts: only ask for OAuth tokens if user selects OAuth authentication method
- Add confirmation step: display all collected values (mask secrets) and ask "Proceed with these settings?"
- Support defaults from environment variables: check process.env first, use as default value if present
- Handle Ctrl+C gracefully: clean exit with message

**Success Criteria**: Prompts are user-friendly; passwords are masked; validates input format; supports defaults
