/**
 * Logger Plugin
 * 
 * Provides enhanced logging for the build process with
 * customizable output formats and log levels.
 */

import { Plugin, BuildContext, DeployContext, ToolContext } from '../plugin-system';

interface LoggerConfig {
    /** Log level: debug, info, warn, error */
    level: 'debug' | 'info' | 'warn' | 'error';
    /** Output format: json, pretty, compact */
    format: 'json' | 'pretty' | 'compact';
    /** Include timestamps */
    timestamps: boolean;
    /** Log file path (optional) */
    logFile?: string;
}

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

class PluginLogger {
    private config: LoggerConfig;
    private startTime: number = 0;

    constructor(config: Partial<LoggerConfig> = {}) {
        this.config = {
            level: config.level ?? 'info',
            format: config.format ?? 'pretty',
            timestamps: config.timestamps ?? true,
            logFile: config.logFile,
        };
    }

    private shouldLog(level: keyof typeof LOG_LEVELS): boolean {
        return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
    }

    private formatMessage(level: string, message: string, data?: unknown): string {
        const timestamp = this.config.timestamps ? new Date().toISOString() : '';

        switch (this.config.format) {
            case 'json':
                return JSON.stringify({ timestamp, level, message, data });
            case 'compact':
                return `[${level.toUpperCase()}] ${message}`;
            case 'pretty':
            default:
                const prefix = this.config.timestamps ? `[${timestamp}]` : '';
                const levelStr = `[${level.toUpperCase()}]`;
                const dataStr = data ? ` ${JSON.stringify(data, null, 2)}` : '';
                return `${prefix} ${levelStr} ${message}${dataStr}`;
        }
    }

    debug(message: string, data?: unknown): void {
        if (this.shouldLog('debug')) {
            console.log(this.formatMessage('debug', message, data));
        }
    }

    info(message: string, data?: unknown): void {
        if (this.shouldLog('info')) {
            console.log(this.formatMessage('info', message, data));
        }
    }

    warn(message: string, data?: unknown): void {
        if (this.shouldLog('warn')) {
            console.warn(this.formatMessage('warn', message, data));
        }
    }

    error(message: string, data?: unknown): void {
        if (this.shouldLog('error')) {
            console.error(this.formatMessage('error', message, data));
        }
    }

    startTimer(): void {
        this.startTime = Date.now();
    }

    elapsed(): number {
        return Date.now() - this.startTime;
    }
}

let logger: PluginLogger;

const plugin: Plugin = {
    meta: {
        name: 'logger',
        version: '1.0.0',
        description: 'Enhanced logging for build process',
        author: 'MCP Generator Team',
        configSchema: {
            type: 'object',
            properties: {
                level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
                format: { type: 'string', enum: ['json', 'pretty', 'compact'] },
                timestamps: { type: 'boolean' },
                logFile: { type: 'string' },
            },
        },
    },

    hooks: {
        async onInit(config) {
            logger = new PluginLogger(config as Partial<LoggerConfig>);
            logger.info('Logger plugin initialized');
        },

        async beforeBuild(context: BuildContext) {
            logger.startTimer();
            logger.info('Build starting', {
                tools: context.tools.length,
                connectors: context.connectors.length,
                outputDir: context.outputDir,
            });
        },

        async afterBuild(context: BuildContext) {
            logger.info(`Build completed in ${logger.elapsed()}ms`, {
                tools: context.tools.map(t => t.name),
                connectors: context.connectors.map(c => c.name),
            });
        },

        async beforeDeploy(context: DeployContext) {
            logger.info('Deploy starting', {
                image: `${context.imageName}:${context.imageTag}`,
                environment: context.environment,
            });
        },

        async afterDeploy(context: DeployContext) {
            logger.info('Deploy completed', {
                image: `${context.imageName}:${context.imageTag}`,
            });
        },

        async onToolLoaded(context: ToolContext) {
            logger.debug(`Tool loaded: ${context.name}`, {
                type: context.type,
                path: context.path,
            });
        },

        async onConnectorLoaded(context: ToolContext) {
            logger.debug(`Connector loaded: ${context.name}`, {
                type: context.type,
                path: context.path,
            });
        },

        async onShutdown() {
            logger.info('Logger plugin shutting down');
        },
    },
};

export default plugin;
