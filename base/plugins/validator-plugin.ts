/**
 * Validator Plugin
 * 
 * Provides custom validation rules for tools, connectors,
 * and configuration during the build process.
 */

import { Plugin, BuildContext, ToolContext } from '../plugin-system';

interface ValidationRule {
  name: string;
  type: 'tool' | 'connector' | 'config' | 'manifest';
  validate: (item: unknown) => ValidationResult;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface ValidatorConfig {
  /** Strict mode - fail on warnings */
  strict: boolean;
  /** Custom rules to apply */
  rules?: string[];
  /** Skip built-in rules */
  skipBuiltIn?: boolean;
}

class PluginValidator {
  private rules: ValidationRule[] = [];
  private config: ValidatorConfig;

  constructor(config: Partial<ValidatorConfig> = {}) {
    this.config = {
      strict: config.strict ?? false,
      rules: config.rules,
      skipBuiltIn: config.skipBuiltIn ?? false,
    };

    if (!this.config.skipBuiltIn) {
      this.registerBuiltInRules();
    }
  }

  private registerBuiltInRules(): void {
    // Tool name validation
    this.rules.push({
      name: 'tool-name-format',
      type: 'tool',
      validate: (tool: unknown) => {
        const t = tool as { name?: string };
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!t.name) {
          errors.push('Tool must have a name');
        } else {
          if (!/^[a-z][a-z0-9-]*$/.test(t.name)) {
            errors.push(`Tool name "${t.name}" must be lowercase with hyphens`);
          }
          if (t.name.length > 64) {
            warnings.push(`Tool name "${t.name}" is longer than 64 characters`);
          }
        }

        return { valid: errors.length === 0, errors, warnings };
      },
    });

    // Tool description validation
    this.rules.push({
      name: 'tool-description-required',
      type: 'tool',
      validate: (tool: unknown) => {
        const t = tool as { meta?: { description?: string } };
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!t.meta?.description) {
          warnings.push('Tool should have a description');
        } else if (t.meta.description.length < 10) {
          warnings.push('Tool description is very short');
        }

        return { valid: true, errors, warnings };
      },
    });

    // Input schema validation
    this.rules.push({
      name: 'tool-input-schema',
      type: 'tool',
      validate: (tool: unknown) => {
        const t = tool as { meta?: { inputSchema?: unknown } };
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!t.meta?.inputSchema) {
          warnings.push('Tool should have an inputSchema for validation');
        }

        return { valid: true, errors, warnings };
      },
    });

    // Connector connection validation
    this.rules.push({
      name: 'connector-connection-method',
      type: 'connector',
      validate: (connector: unknown) => {
        const c = connector as { exports?: { connect?: unknown; disconnect?: unknown } };
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!c.exports?.connect) {
          warnings.push('Connector should export a connect method');
        }
        if (!c.exports?.disconnect) {
          warnings.push('Connector should export a disconnect method');
        }

        return { valid: true, errors, warnings };
      },
    });

    // Config required fields
    this.rules.push({
      name: 'config-required-fields',
      type: 'config',
      validate: (config: unknown) => {
        const c = config as Record<string, unknown>;
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!c.serverName) {
          errors.push('Config must have serverName');
        }
        if (!c.version) {
          warnings.push('Config should have a version');
        }

        return { valid: errors.length === 0, errors, warnings };
      },
    });

    // Manifest validation
    this.rules.push({
      name: 'manifest-tools-present',
      type: 'manifest',
      validate: (manifest: unknown) => {
        const m = manifest as { tools?: unknown[] };
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!m.tools || m.tools.length === 0) {
          warnings.push('Manifest has no tools - server will have no functionality');
        }

        return { valid: true, errors, warnings };
      },
    });
  }

  registerRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  validateTool(tool: ToolContext): ValidationResult {
    return this.runRules('tool', tool);
  }

  validateConnector(connector: ToolContext): ValidationResult {
    return this.runRules('connector', connector);
  }

  validateConfig(config: unknown): ValidationResult {
    return this.runRules('config', config);
  }

  validateManifest(manifest: unknown): ValidationResult {
    return this.runRules('manifest', manifest);
  }

  private runRules(type: ValidationRule['type'], item: unknown): ValidationResult {
    const applicableRules = this.rules.filter(r => r.type === type);
    
    if (this.config.rules) {
      // Filter to only specified rules
      const ruleNames = new Set(this.config.rules);
      applicableRules.filter(r => ruleNames.has(r.name));
    }

    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    for (const rule of applicableRules) {
      const result = rule.validate(item);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    }

    // In strict mode, warnings become errors
    if (this.config.strict) {
      allErrors.push(...allWarnings);
      allWarnings.length = 0;
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
    };
  }
}

let validator: PluginValidator;

const plugin: Plugin = {
  meta: {
    name: 'validator',
    version: '1.0.0',
    description: 'Custom validation rules for build process',
    author: 'MCP Generator Team',
    configSchema: {
      type: 'object',
      properties: {
        strict: { type: 'boolean' },
        rules: { type: 'array', items: { type: 'string' } },
        skipBuiltIn: { type: 'boolean' },
      },
    },
  },

  hooks: {
    async onInit(config) {
      validator = new PluginValidator(config as Partial<ValidatorConfig>);
      console.log('[validator] Validation plugin initialized');
    },

    async beforeBuild(context: BuildContext) {
      // Validate configuration
      const configResult = validator.validateConfig(context.config);
      
      if (!configResult.valid) {
        console.error('[validator] Configuration validation failed:');
        for (const error of configResult.errors) {
          console.error(`  - ${error}`);
        }
        throw new Error('Configuration validation failed');
      }

      for (const warning of configResult.warnings) {
        console.warn(`[validator] Warning: ${warning}`);
      }
    },

    async onToolLoaded(context: ToolContext) {
      const result = validator.validateTool(context);

      if (!result.valid) {
        console.error(`[validator] Tool "${context.name}" validation failed:`);
        for (const error of result.errors) {
          console.error(`  - ${error}`);
        }
        throw new Error(`Tool "${context.name}" validation failed`);
      }

      for (const warning of result.warnings) {
        console.warn(`[validator] Tool "${context.name}": ${warning}`);
      }

      return { context };
    },

    async onConnectorLoaded(context: ToolContext) {
      const result = validator.validateConnector(context);

      if (!result.valid) {
        console.error(`[validator] Connector "${context.name}" validation failed:`);
        for (const error of result.errors) {
          console.error(`  - ${error}`);
        }
        throw new Error(`Connector "${context.name}" validation failed`);
      }

      for (const warning of result.warnings) {
        console.warn(`[validator] Connector "${context.name}": ${warning}`);
      }
    },

    async onManifestGenerated(manifest) {
      const result = validator.validateManifest(manifest);

      if (!result.valid) {
        console.error('[validator] Manifest validation failed:');
        for (const error of result.errors) {
          console.error(`  - ${error}`);
        }
        throw new Error('Manifest validation failed');
      }

      for (const warning of result.warnings) {
        console.warn(`[validator] Manifest: ${warning}`);
      }

      return manifest;
    },
  },
};

export default plugin;
export { PluginValidator, ValidationRule, ValidationResult };
