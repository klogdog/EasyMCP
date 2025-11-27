/**
 * Test Fixtures
 * 
 * Sample data and configurations for testing the MCP generator.
 * Provides realistic examples of tools, connectors, configs, and manifests.
 * 
 * @module test-utils/fixtures
 */

/**
 * Sample tool definitions for testing
 */
export const sampleTools = {
    calculator: {
        name: 'calculator',
        filename: 'calculator.py',
        language: 'python',
        content: `"""
Calculator Tool - Performs basic arithmetic operations

@tool calculator
@description Performs arithmetic calculations
@param operation string The operation to perform (add, subtract, multiply, divide)
@param a number First operand
@param b number Second operand
@returns number The result of the calculation
"""

def calculator(operation: str, a: float, b: float) -> float:
    """Perform arithmetic calculation."""
    if operation == "add":
        return a + b
    elif operation == "subtract":
        return a - b
    elif operation == "multiply":
        return a * b
    elif operation == "divide":
        if b == 0:
            raise ValueError("Cannot divide by zero")
        return a / b
    else:
        raise ValueError(f"Unknown operation: {operation}")
`,
        metadata: {
            name: 'calculator',
            description: 'Performs arithmetic calculations',
            parameters: [
                { name: 'operation', type: 'string', description: 'The operation to perform' },
                { name: 'a', type: 'number', description: 'First operand' },
                { name: 'b', type: 'number', description: 'Second operand' }
            ],
            returns: { type: 'number', description: 'The result of the calculation' }
        }
    },

    summarize: {
        name: 'summarize',
        filename: 'summarize.ts',
        language: 'typescript',
        content: `/**
 * Summarize Tool - Creates text summaries
 * 
 * @tool summarize
 * @description Creates a summary of the provided text
 * @param text string The text to summarize
 * @param maxLength number Maximum length of the summary
 * @returns string The summarized text
 */

export async function summarize(text: string, maxLength: number = 200): Promise<string> {
  // Simple summarization logic for testing
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}
`,
        metadata: {
            name: 'summarize',
            description: 'Creates a summary of the provided text',
            parameters: [
                { name: 'text', type: 'string', description: 'The text to summarize' },
                { name: 'maxLength', type: 'number', description: 'Maximum length of the summary', default: 200 }
            ],
            returns: { type: 'string', description: 'The summarized text' }
        }
    },

    translate: {
        name: 'translate',
        filename: 'translate.ts',
        language: 'typescript',
        content: `/**
 * Translate Tool - Translates text between languages
 * 
 * @tool translate
 * @description Translates text from one language to another
 * @param text string The text to translate
 * @param targetLanguage string The target language code
 * @param sourceLanguage string The source language code (optional, auto-detect)
 * @returns string The translated text
 */

export async function translate(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string
): Promise<string> {
  // Mock translation for testing
  return \`[Translated to \${targetLanguage}]: \${text}\`;
}
`,
        metadata: {
            name: 'translate',
            description: 'Translates text from one language to another',
            parameters: [
                { name: 'text', type: 'string', description: 'The text to translate' },
                { name: 'targetLanguage', type: 'string', description: 'The target language code' },
                { name: 'sourceLanguage', type: 'string', description: 'The source language code', optional: true }
            ],
            returns: { type: 'string', description: 'The translated text' }
        }
    }
};

/**
 * Sample connector definitions for testing
 */
export const sampleConnectors = {
    database: {
        name: 'database-connector',
        filename: 'database-connector.py',
        language: 'python',
        content: `"""
Database Connector - PostgreSQL connection management

@connector database
@description Manages PostgreSQL database connections
@config host string Database host
@config port number Database port (default: 5432)
@config database string Database name
@secret DB_USER Database username
@secret DB_PASSWORD Database password
"""

import os

class DatabaseConnector:
    def __init__(self):
        self.host = os.environ.get('DB_HOST', 'localhost')
        self.port = int(os.environ.get('DB_PORT', '5432'))
        self.database = os.environ.get('DB_NAME', 'test')
        self.user = os.environ.get('DB_USER')
        self.password = os.environ.get('DB_PASSWORD')
    
    def connect(self):
        # Mock connection for testing
        return f"Connected to {self.database}@{self.host}:{self.port}"
`,
        metadata: {
            name: 'database-connector',
            description: 'Manages PostgreSQL database connections',
            config: [
                { name: 'host', type: 'string', description: 'Database host' },
                { name: 'port', type: 'number', description: 'Database port', default: 5432 },
                { name: 'database', type: 'string', description: 'Database name' }
            ],
            secrets: ['DB_USER', 'DB_PASSWORD']
        }
    },

    email: {
        name: 'email-connector',
        filename: 'email-connector.ts',
        language: 'typescript',
        content: `/**
 * Email Connector - SMTP email sending
 * 
 * @connector email
 * @description Sends emails via SMTP
 * @config smtpHost string SMTP server host
 * @config smtpPort number SMTP server port (default: 587)
 * @secret SMTP_USER SMTP username
 * @secret SMTP_PASSWORD SMTP password
 */

export class EmailConnector {
  private host: string;
  private port: number;
  private user: string;
  private password: string;
  
  constructor() {
    this.host = process.env.SMTP_HOST || 'smtp.example.com';
    this.port = parseInt(process.env.SMTP_PORT || '587', 10);
    this.user = process.env.SMTP_USER || '';
    this.password = process.env.SMTP_PASSWORD || '';
  }
  
  async sendEmail(to: string, subject: string, body: string): Promise<boolean> {
    // Mock sending for testing
    console.log(\`Sending email to \${to}: \${subject}\`);
    return true;
  }
}
`,
        metadata: {
            name: 'email-connector',
            description: 'Sends emails via SMTP',
            config: [
                { name: 'smtpHost', type: 'string', description: 'SMTP server host' },
                { name: 'smtpPort', type: 'number', description: 'SMTP server port', default: 587 }
            ],
            secrets: ['SMTP_USER', 'SMTP_PASSWORD']
        }
    }
};

/**
 * Sample configuration for testing
 */
export const sampleConfig = {
    basic: {
        yaml: `# MCP Server Configuration
server:
  name: test-mcp-server
  version: "1.0.0"
  description: Test MCP server for unit testing

tools:
  - name: calculator
    enabled: true
  - name: summarize
    enabled: true

connectors:
  - name: database-connector
    enabled: true
    config:
      host: localhost
      port: 5432
      database: testdb

logging:
  level: info
  format: json
`,
        parsed: {
            server: {
                name: 'test-mcp-server',
                version: '1.0.0',
                description: 'Test MCP server for unit testing'
            },
            tools: [
                { name: 'calculator', enabled: true },
                { name: 'summarize', enabled: true }
            ],
            connectors: [
                {
                    name: 'database-connector',
                    enabled: true,
                    config: { host: 'localhost', port: 5432, database: 'testdb' }
                }
            ],
            logging: { level: 'info', format: 'json' }
        }
    },

    withVariables: {
        yaml: `server:
  name: \${SERVER_NAME:-my-server}
  port: \${SERVER_PORT:-3000}

database:
  host: \${DB_HOST}
  port: \${DB_PORT:-5432}
  name: \${DB_NAME}
`,
        envVars: {
            SERVER_NAME: 'production-server',
            DB_HOST: 'db.example.com',
            DB_NAME: 'production'
        },
        expected: {
            server: {
                name: 'production-server',
                port: 3000 // default
            },
            database: {
                host: 'db.example.com',
                port: 5432, // default
                name: 'production'
            }
        }
    }
};

/**
 * Sample manifest for testing
 */
export const sampleManifest = {
    valid: {
        name: 'test-mcp-server',
        version: '1.0.0',
        description: 'A test MCP server',
        tools: [
            {
                name: 'calculator',
                description: 'Performs arithmetic calculations',
                inputSchema: {
                    type: 'object',
                    properties: {
                        operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
                        a: { type: 'number' },
                        b: { type: 'number' }
                    },
                    required: ['operation', 'a', 'b']
                }
            },
            {
                name: 'summarize',
                description: 'Creates a summary of text',
                inputSchema: {
                    type: 'object',
                    properties: {
                        text: { type: 'string' },
                        maxLength: { type: 'number', default: 200 }
                    },
                    required: ['text']
                }
            }
        ],
        resources: [],
        capabilities: ['tools']
    },

    minimal: {
        name: 'minimal-server',
        version: '0.1.0',
        tools: [],
        resources: [],
        capabilities: []
    },

    invalid: {
        // Missing required 'name' field
        version: '1.0.0',
        tools: []
    }
};

/**
 * Sample Dockerfile content for testing
 */
export const sampleDockerfile = `FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start server
CMD ["node", "dist/server.js"]
`;

/**
 * Sample error scenarios for testing error handling
 */
export const errorScenarios = {
    invalidYaml: `server:
  name: test
  port: [invalid
    yaml: syntax
`,

    missingRequiredField: {
        // Missing 'name' field
        version: '1.0.0',
        description: 'Missing name field'
    },

    duplicateToolName: [
        { name: 'duplicate-tool', description: 'First tool' },
        { name: 'duplicate-tool', description: 'Duplicate name' }
    ],

    invalidSecretFormat: {
        secrets: [
            'VALID_SECRET',
            '123-invalid', // Can't start with number
            'also invalid', // Can't have spaces
        ]
    }
};

export default {
    sampleTools,
    sampleConnectors,
    sampleConfig,
    sampleManifest,
    sampleDockerfile,
    errorScenarios
};
