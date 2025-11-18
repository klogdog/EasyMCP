## Create a new git branch for the task from Phase3 and merge back into Phase3 when finished

# Work Notes - Task 3.1: Create Interactive Prompt System

## Current Status

**Task 2.4 (Build Configuration Generator)** has been **COMPLETED** ✅

### What Was Done in Task 2.4

The previous agent successfully:

1. **Reviewed Task 2.3** and wrote approval in TaskReview3.md
2. **Installed js-yaml dependency** (v4.1.0 with @types/js-yaml v4.0.9)
3. **Created `base/config-generator.ts`** with:
   - TypeScript interfaces: ServerConfig, ConnectorConfig
   - Main export: `async function generateConfig(manifest: MCPManifest, env: 'development' | 'production'): Promise<string>`
   - Environment-specific configurations (development/production)
   - Connector credential placeholders with environment variables
   - Feature flag generation from capabilities
   - Helper functions: `createConnectorConfig()`, `getEnvVarName()`, `camelToSnakeCase()`, `validateConfig()`
4. **Created comprehensive test suite** (`base/test-config-generator.ts`):
   - 8 test scenarios covering all generation cases
   - All tests pass successfully
   - Tests: dev config, prod config, connectors, features, database, validation, env vars, file saving
5. **Generated sample configurations**:
   - `config/development.yaml` - localhost, debug logging
   - `config/production.yaml` - 0.0.0.0 host, info logging, env var placeholders
6. **Updated documentation**:
   - TaskCheckList2.md marked Task 2.4 complete
   - TaskCompleteNote4.md created with comprehensive details
7. **Branch**: Changes merged to Phase2 from `task-2.4`

### Review Required

**IMPORTANT**: Before starting Task 3.1, you must verify the review work completed in Task 2.4:

1. **Check TaskCompleteNote4.md**: Read `/workspace/ActionPlan/Phase2/Task4/TaskCompleteNote4.md` to understand what was completed
2. **Verify config-generator.ts**: Review `/workspace/base/config-generator.ts` structure and implementation
3. **Test the generator**: Run `npm run build && node dist/test-config-generator.js` to verify it works
4. **Check generated configs**: Review `config/development.yaml` and `config/production.yaml` files
5. **Document Review**: Write your review findings in `/workspace/ActionPlan/Phase2/Task4/TaskReview4.md`

### Your Review Should Include

In `TaskReview4.md`, document:

- ✅ What was done correctly
- ⚠️ Any issues or concerns found
- 💡 Suggestions for improvement (if any)
- ✔️ Final approval status (APPROVED / NEEDS REVISION)

## Your Task: Task 3.1 - Create Interactive Prompt System

Once you've completed the review of Task 2.4, proceed with Task 3.1.

### Task 3.1 Objectives

**Goal**: Build user-friendly CLI prompts for collecting credentials and configuration from users interactively.

This task begins Phase 3: User Interaction & Secrets. You'll create an interactive prompt system using the inquirer library that collects credentials with validation, environment variable defaults, and secure password masking.

**Actions Required**:

1. **Install inquirer Dependency**
   - Run `npm install inquirer @types/inquirer`
   - This library provides interactive command-line prompts

2. **Create `base/prompt.ts` file**
   - Main export: `async function promptForCredentials(requirements: CredentialRequirement[]): Promise<Record<string, string>>`
   - Import inquirer types and utilities

3. **Define CredentialRequirement Interface**

   ```typescript
   export interface CredentialRequirement {
     name: string;
     type: "text" | "password" | "confirm" | "list";
     required: boolean;
     description: string;
     validation?: RegExp | ((value: string) => boolean | string);
     choices?: string[];
     default?: string;
   }
   ```

4. **Implement Main Prompt Function**
   - Accept array of CredentialRequirement objects
   - Check environment variables first for defaults
   - Convert credential names to ENV_VAR format (UPPERCASE_WITH_UNDERSCORES)
   - Return Record<string, string> with collected values

5. **Build Prompt Logic**
   - Loop through each requirement
   - Map requirement.type to inquirer prompt type:
     - `text` → `input`
     - `password` → `password` (masked)
     - `confirm` → `confirm` (yes/no)
     - `list` → `list` (dropdown)
   - Construct inquirer question object with type, name, message, default, validate

6. **Implement Validation Functions**
   - Create helper validators:
     - `validateEmail(value: string): boolean | string`
     - `validateUrl(value: string): boolean | string`
     - `validateNonEmpty(value: string): boolean | string`
     - `validateNumericRange(min: number, max: number)` - factory function
   - Apply validators from requirement.validation field
   - Return error message string if invalid, true if valid

7. **Implement Conditional Prompts**
   - Add `when` callback to check previous answers
   - Example: Only ask for OAuth token if auth method === "oauth"
   - Use inquirer's conditional prompt feature

8. **Add Confirmation Step**
   - After collecting all values, display summary
   - Mask secrets: show only first 2 and last 2 characters
   - Show full text for non-password fields
   - Prompt: "Proceed with these settings?" (yes/no)
   - If no, restart or exit

9. **Handle Graceful Exit**
   - Wrap in try-catch block
   - Catch Ctrl+C (process interruption)
   - Display message: "Configuration cancelled by user"
   - Call `process.exit(0)` for clean exit

10. **Error Handling**
    - Validate inputs (non-empty requirements array)
    - Handle validation errors gracefully
    - Provide clear error messages
    - Allow retry on validation failure

### Implementation Guidance

```typescript
import inquirer from "inquirer";

export interface CredentialRequirement {
  name: string;
  type: "text" | "password" | "confirm" | "list";
  required: boolean;
  description: string;
  validation?: RegExp | ((value: string) => boolean | string);
  choices?: string[];
  default?: string;
}

export async function promptForCredentials(
  requirements: CredentialRequirement[]
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  try {
    // Build inquirer questions
    const questions = requirements.map((req) => {
      const envVarName = toEnvVarName(req.name);
      const envDefault = process.env[envVarName] || req.default;

      return {
        type: mapPromptType(req.type),
        name: req.name,
        message: req.description,
        default: envDefault,
        choices: req.choices,
        validate: (value: string) => {
          if (req.required && !value) {
            return "This field is required";
          }
          if (req.validation) {
            if (req.validation instanceof RegExp) {
              return req.validation.test(value) || "Invalid format";
            }
            return req.validation(value);
          }
          return true;
        },
      };
    });

    // Prompt user
    const answers = await inquirer.prompt(questions);

    // Confirmation step
    console.log("\n=== Configuration Summary ===");
    for (const [key, value] of Object.entries(answers)) {
      const req = requirements.find((r) => r.name === key);
      if (req?.type === "password") {
        console.log(`${key}: ${maskSecret(value as string)}`);
      } else {
        console.log(`${key}: ${value}`);
      }
    }

    const { proceed } = await inquirer.prompt([
      {
        type: "confirm",
        name: "proceed",
        message: "Proceed with these settings?",
        default: true,
      },
    ]);

    if (!proceed) {
      console.log("Configuration cancelled by user");
      process.exit(0);
    }

    return answers as Record<string, string>;
  } catch (error) {
    if ((error as any).isTtyError) {
      console.error("Prompt couldn't be rendered in the current environment");
    } else {
      console.log("\nConfiguration cancelled by user");
    }
    process.exit(0);
  }
}

function mapPromptType(type: string): string {
  const mapping: Record<string, string> = {
    text: "input",
    password: "password",
    confirm: "confirm",
    list: "list",
  };
  return mapping[type] || "input";
}

function toEnvVarName(name: string): string {
  return name
    .replace(/[A-Z]/g, (letter) => `_${letter}`)
    .replace(/[-\s]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_/, "")
    .toUpperCase();
}

function maskSecret(value: string): string {
  if (value.length <= 4) return "****";
  return value.substring(0, 2) + "****" + value.substring(value.length - 2);
}

export function validateEmail(value: string): boolean | string {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value) || "Invalid email format";
}

export function validateUrl(value: string): boolean | string {
  try {
    new URL(value);
    return true;
  } catch {
    return "Invalid URL format";
  }
}

export function validateNonEmpty(value: string): boolean | string {
  return value.trim().length > 0 || "This field cannot be empty";
}

export function validateNumericRange(
  min: number,
  max: number
): (value: string) => boolean | string {
  return (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return "Must be a number";
    if (num < min || num > max) return `Must be between ${min} and ${max}`;
    return true;
  };
}
```

### Testing Strategy

Create `base/test-prompt.ts`:

1. **Test 1: Text Input with Validation**
   - Create requirement with text type
   - Add email validation
   - Verify validation works

2. **Test 2: Password Masking**
   - Create requirement with password type
   - Verify input is masked during entry
   - Verify masked display in confirmation

3. **Test 3: Confirm Prompt**
   - Create requirement with confirm type
   - Verify yes/no response

4. **Test 4: List Selection**
   - Create requirement with list type and choices
   - Verify dropdown selection works

5. **Test 5: Environment Variable Defaults**
   - Set environment variable
   - Verify it's used as default value
   - Test with ENV_VAR naming convention

6. **Test 6: Validation Failures**
   - Test invalid email format
   - Test invalid URL format
   - Test empty required field
   - Verify error messages

7. **Test 7: Conditional Prompts**
   - Create dependent requirements
   - Verify conditional logic works
   - Test when callback

8. **Test 8: Confirmation and Summary**
   - Complete full flow
   - Verify summary displays correctly
   - Verify secrets are masked
   - Test proceed/cancel options

### Success Criteria

✅ **User-friendly prompts**: Clear descriptions and helpful messages  
✅ **Password masking**: Passwords masked during input and in summary  
✅ **Input validation**: Email, URL, non-empty, numeric range validators work  
✅ **Environment defaults**: Checks process.env and uses as defaults  
✅ **Confirmation step**: Displays summary with masked secrets  
✅ **Graceful exit**: Ctrl+C handled without stack trace  
✅ **Conditional prompts**: When callbacks work based on previous answers  
✅ **Comprehensive tests**: All 8 test scenarios pass

### Documentation Requirements

After completing the task:

1. Update `TaskCheckList3.md` - mark Task 3.1 as complete
2. Create `TaskCompleteNote1.md` with:
   - Summary of what was implemented
   - List of interfaces and functions created
   - Test results (all scenarios)
   - Sample prompt interactions
   - Files created/modified
   - Success criteria verification

### Branch Workflow

1. Create branch `task-3.1` from Phase3
2. Implement all required functionality
3. Run all tests and verify they pass
4. Commit changes with descriptive message
5. Merge back to Phase3 using `git merge --no-ff task-3.1`

## Next Task Preview

After Task 3.1 is complete, Task 3.2 will focus on building the secret manager for encrypting and storing collected credentials securely.

## Reference Files

- Task details: `/workspace/ActionPlan/Phase3/Task1/Task1.md`
- Checklist: `/workspace/ActionPlan/Phase3/TaskCheckList3.md`
- Previous task: `/workspace/ActionPlan/Phase2/Task4/TaskCompleteNote4.md`
- Config generator: `/workspace/base/config-generator.ts`
- Generated configs: `/workspace/config/development.yaml`, `/workspace/config/production.yaml`

## Getting Started

1. First, review Task 2.4 (see "Review Required" section above)
2. Write your review in TaskReview4.md
3. Install inquirer: `npm install inquirer @types/inquirer`
4. Create the `base/prompt.ts` file with required interfaces
5. Implement prompt function with validation helpers
6. Implement confirmation step with secret masking
7. Test with sample requirements
8. Create test script to verify all scenarios
9. Compile and verify no errors
10. Document completion and update checklist
11. Rewrite this file for the next agent (Task 3.2)

## Branch Management

- **Current Branch**: You should be on `task-2.4` or `Phase2`
- **Action**: Create branch `task-3.1` from `Phase3` for your work
- **Merge Target**: Merge back into `Phase3` when complete
