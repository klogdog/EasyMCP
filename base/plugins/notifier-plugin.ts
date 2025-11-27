/**
 * Notifier Plugin
 * 
 * Sends notifications on build and deploy events to
 * various channels (Slack, Discord, webhooks).
 */

import { Plugin, BuildContext, DeployContext } from '../plugin-system';

interface NotifierConfig {
  /** Notification channels */
  channels: NotificationChannel[];
  /** Events to notify on */
  events: ('build-start' | 'build-success' | 'build-failure' | 'deploy-start' | 'deploy-success' | 'deploy-failure')[];
  /** Include detailed info in notifications */
  detailed: boolean;
}

interface NotificationChannel {
  type: 'slack' | 'discord' | 'webhook';
  url: string;
  name?: string;
}

interface Notification {
  title: string;
  message: string;
  status: 'success' | 'failure' | 'info';
  details?: Record<string, unknown>;
  timestamp: Date;
}

class NotificationSender {
  private channels: NotificationChannel[];
  private detailed: boolean;

  constructor(config: Partial<NotifierConfig> = {}) {
    this.channels = config.channels ?? [];
    this.detailed = config.detailed ?? false;
  }

  async send(notification: Notification): Promise<void> {
    for (const channel of this.channels) {
      try {
        await this.sendToChannel(channel, notification);
      } catch (error) {
        console.error(`[notifier] Failed to send to ${channel.type}:`, error);
      }
    }
  }

  private async sendToChannel(channel: NotificationChannel, notification: Notification): Promise<void> {
    const payload = this.formatPayload(channel.type, notification);
    
    // In production, this would use fetch or axios
    // For demo, we just log the notification
    console.log(`[notifier] Would send to ${channel.type}:`, JSON.stringify(payload, null, 2));
    
    // Example actual implementation:
    // await fetch(channel.url, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(payload),
    // });
  }

  private formatPayload(type: string, notification: Notification): unknown {
    switch (type) {
      case 'slack':
        return this.formatSlack(notification);
      case 'discord':
        return this.formatDiscord(notification);
      case 'webhook':
      default:
        return this.formatWebhook(notification);
    }
  }

  private formatSlack(notification: Notification): unknown {
    const color = notification.status === 'success' ? '#36a64f' 
      : notification.status === 'failure' ? '#dc3545' 
      : '#0088cc';

    const fields = this.detailed && notification.details
      ? Object.entries(notification.details).map(([key, value]) => ({
          title: key,
          value: String(value),
          short: true,
        }))
      : [];

    return {
      attachments: [{
        color,
        title: notification.title,
        text: notification.message,
        fields,
        ts: Math.floor(notification.timestamp.getTime() / 1000),
      }],
    };
  }

  private formatDiscord(notification: Notification): unknown {
    const color = notification.status === 'success' ? 0x36a64f 
      : notification.status === 'failure' ? 0xdc3545 
      : 0x0088cc;

    const fields = this.detailed && notification.details
      ? Object.entries(notification.details).map(([name, value]) => ({
          name,
          value: String(value),
          inline: true,
        }))
      : [];

    return {
      embeds: [{
        title: notification.title,
        description: notification.message,
        color,
        fields,
        timestamp: notification.timestamp.toISOString(),
      }],
    };
  }

  private formatWebhook(notification: Notification): unknown {
    return {
      event: notification.title,
      message: notification.message,
      status: notification.status,
      details: this.detailed ? notification.details : undefined,
      timestamp: notification.timestamp.toISOString(),
    };
  }
}

let sender: NotificationSender;
let config: NotifierConfig;
let buildStartTime: Date;

const plugin: Plugin = {
  meta: {
    name: 'notifier',
    version: '1.0.0',
    description: 'Send notifications on build and deploy events',
    author: 'MCP Generator Team',
    configSchema: {
      type: 'object',
      properties: {
        channels: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['slack', 'discord', 'webhook'] },
              url: { type: 'string' },
              name: { type: 'string' },
            },
            required: ['type', 'url'],
          },
        },
        events: {
          type: 'array',
          items: { type: 'string' },
        },
        detailed: { type: 'boolean' },
      },
    },
  },

  hooks: {
    async onInit(initConfig) {
      config = initConfig as unknown as NotifierConfig;
      sender = new NotificationSender(config);
      console.log('[notifier] Notifier plugin initialized');
    },

    async beforeBuild(context: BuildContext) {
      buildStartTime = new Date();
      
      if (config.events?.includes('build-start')) {
        await sender.send({
          title: 'Build Started',
          message: `Building MCP server with ${context.tools.length} tools and ${context.connectors.length} connectors`,
          status: 'info',
          details: {
            version: context.buildMeta.version,
            environment: context.buildMeta.environment,
            outputDir: context.outputDir,
          },
          timestamp: buildStartTime,
        });
      }
    },

    async afterBuild(context: BuildContext) {
      if (config.events?.includes('build-success')) {
        const duration = Date.now() - buildStartTime.getTime();
        
        await sender.send({
          title: 'Build Successful',
          message: `MCP server build completed in ${duration}ms`,
          status: 'success',
          details: {
            tools: context.tools.map(t => t.name).join(', '),
            connectors: context.connectors.map(c => c.name).join(', ') || 'none',
            duration: `${duration}ms`,
          },
          timestamp: new Date(),
        });
      }
    },

    async beforeDeploy(context: DeployContext) {
      if (config.events?.includes('deploy-start')) {
        await sender.send({
          title: 'Deploy Started',
          message: `Deploying ${context.imageName}:${context.imageTag} to ${context.environment}`,
          status: 'info',
          details: {
            image: `${context.imageName}:${context.imageTag}`,
            environment: context.environment,
          },
          timestamp: new Date(),
        });
      }
    },

    async afterDeploy(context: DeployContext) {
      if (config.events?.includes('deploy-success')) {
        await sender.send({
          title: 'Deploy Successful',
          message: `Successfully deployed ${context.imageName}:${context.imageTag}`,
          status: 'success',
          details: {
            image: `${context.imageName}:${context.imageTag}`,
            environment: context.environment,
          },
          timestamp: new Date(),
        });
      }
    },

    async onShutdown() {
      console.log('[notifier] Notifier plugin shutting down');
    },
  },
};

export default plugin;
export { NotificationSender, Notification, NotificationChannel };
