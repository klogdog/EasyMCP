/**
 * Tests for Health Check System Template
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Mock types and classes (simulating the template)
interface HealthCheckResult {
    name: string;
    status: 'healthy' | 'unhealthy' | 'degraded';
    message?: string;
    latency?: number;
    lastCheck?: string;
}

interface HealthStatus {
    status: 'ok' | 'degraded' | 'unhealthy';
    uptime: number;
    timestamp: string;
    version: string;
    tools: string[];
    connectors: string[];
    checks: Record<string, HealthCheckResult>;
}

type HealthCheckFunction = () => Promise<HealthCheckResult>;

class HealthCheckManager {
    private startTime: number;
    private version: string;
    private checks: Map<string, HealthCheckFunction> = new Map();
    private lastResults: Map<string, HealthCheckResult> = new Map();

    constructor(version: string = '1.0.0') {
        this.startTime = Date.now();
        this.version = version;
    }

    registerCheck(name: string, checkFn: HealthCheckFunction): void {
        this.checks.set(name, checkFn);
    }

    removeCheck(name: string): boolean {
        this.lastResults.delete(name);
        return this.checks.delete(name);
    }

    getUptime(): number {
        return Math.floor((Date.now() - this.startTime) / 1000);
    }

    async runAllChecks(): Promise<Map<string, HealthCheckResult>> {
        for (const [name, checkFn] of this.checks) {
            try {
                const result = await checkFn();
                this.lastResults.set(name, {
                    ...result,
                    lastCheck: new Date().toISOString(),
                });
            } catch (error) {
                this.lastResults.set(name, {
                    name,
                    status: 'unhealthy',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    lastCheck: new Date().toISOString(),
                });
            }
        }
        return new Map(this.lastResults);
    }

    async getHealthStatus(tools: string[], connectors: string[]): Promise<HealthStatus> {
        await this.runAllChecks();

        const checks: Record<string, HealthCheckResult> = {};
        let hasUnhealthy = false;
        let hasDegraded = false;

        for (const [name, result] of this.lastResults) {
            checks[name] = result;
            if (result.status === 'unhealthy') {
                hasUnhealthy = true;
            } else if (result.status === 'degraded') {
                hasDegraded = true;
            }
        }

        let status: 'ok' | 'degraded' | 'unhealthy';
        if (hasUnhealthy) {
            status = 'unhealthy';
        } else if (hasDegraded) {
            status = 'degraded';
        } else {
            status = 'ok';
        }

        return {
            status,
            uptime: this.getUptime(),
            timestamp: new Date().toISOString(),
            version: this.version,
            tools,
            connectors,
            checks,
        };
    }

    async getReadinessStatus(): Promise<{ ready: boolean; checks: Record<string, boolean> }> {
        await this.runAllChecks();

        const checks: Record<string, boolean> = {};
        let allReady = true;

        for (const [name, result] of this.lastResults) {
            const isReady = result.status !== 'unhealthy';
            checks[name] = isReady;
            if (!isReady) {
                allReady = false;
            }
        }

        return { ready: allReady, checks };
    }

    getLivenessStatus(): { alive: boolean; uptime: number } {
        return {
            alive: true,
            uptime: this.getUptime(),
        };
    }
}

describe('HealthCheckManager', () => {
    let manager: HealthCheckManager;

    beforeEach(() => {
        manager = new HealthCheckManager('1.0.0');
    });

    describe('registerCheck', () => {
        it('should register a health check', async () => {
            let called = false;
            const mockCheck: HealthCheckFunction = async () => {
                called = true;
                return { name: 'test-check', status: 'healthy' };
            };

            manager.registerCheck('test', mockCheck);
            await manager.runAllChecks();

            expect(called).toBe(true);
        });

        it('should allow multiple checks', async () => {
            let count = 0;
            const check1: HealthCheckFunction = async () => {
                count++;
                return { name: 'check1', status: 'healthy' };
            };
            const check2: HealthCheckFunction = async () => {
                count++;
                return { name: 'check2', status: 'healthy' };
            };

            manager.registerCheck('check1', check1);
            manager.registerCheck('check2', check2);

            await manager.runAllChecks();

            expect(count).toBe(2);
        });
    });

    describe('removeCheck', () => {
        it('should remove a registered check', async () => {
            let called = false;
            const mockCheck: HealthCheckFunction = async () => {
                called = true;
                return { name: 'test', status: 'healthy' };
            };

            manager.registerCheck('test', mockCheck);
            const removed = manager.removeCheck('test');

            expect(removed).toBe(true);

            await manager.runAllChecks();
            expect(called).toBe(false);
        });

        it('should return false for non-existent check', () => {
            const removed = manager.removeCheck('non-existent');
            expect(removed).toBe(false);
        });
    });

    describe('getHealthStatus', () => {
        it('should return ok status when all checks pass', async () => {
            manager.registerCheck('db', async () => ({
                name: 'db',
                status: 'healthy',
            }));

            const status = await manager.getHealthStatus(['tool1'], ['connector1']);

            expect(status.status).toBe('ok');
            expect(status.tools).toEqual(['tool1']);
            expect(status.connectors).toEqual(['connector1']);
            expect(status.version).toBe('1.0.0');
        });

        it('should return degraded status when some checks are degraded', async () => {
            manager.registerCheck('db', async () => ({
                name: 'db',
                status: 'healthy',
            }));
            manager.registerCheck('cache', async () => ({
                name: 'cache',
                status: 'degraded',
            }));

            const status = await manager.getHealthStatus([], []);

            expect(status.status).toBe('degraded');
        });

        it('should return unhealthy status when any check fails', async () => {
            manager.registerCheck('db', async () => ({
                name: 'db',
                status: 'healthy',
            }));
            manager.registerCheck('critical', async () => ({
                name: 'critical',
                status: 'unhealthy',
            }));

            const status = await manager.getHealthStatus([], []);

            expect(status.status).toBe('unhealthy');
        });

        it('should handle check errors gracefully', async () => {
            manager.registerCheck('failing', async (): Promise<HealthCheckResult> => {
                throw new Error('Connection failed');
            });

            const status = await manager.getHealthStatus([], []);

            expect(status.status).toBe('unhealthy');
            expect(status.checks['failing']?.status).toBe('unhealthy');
            expect(status.checks['failing']?.message).toBe('Connection failed');
        });
    });

    describe('getReadinessStatus', () => {
        it('should return ready when all checks pass', async () => {
            manager.registerCheck('db', async () => ({
                name: 'db',
                status: 'healthy',
            }));

            const readiness = await manager.getReadinessStatus();

            expect(readiness.ready).toBe(true);
            expect(readiness.checks['db']).toBe(true);
        });

        it('should return not ready when any check fails', async () => {
            manager.registerCheck('db', async () => ({
                name: 'db',
                status: 'unhealthy',
            }));

            const readiness = await manager.getReadinessStatus();

            expect(readiness.ready).toBe(false);
            expect(readiness.checks['db']).toBe(false);
        });

        it('should consider degraded as ready', async () => {
            manager.registerCheck('cache', async () => ({
                name: 'cache',
                status: 'degraded',
            }));

            const readiness = await manager.getReadinessStatus();

            expect(readiness.ready).toBe(true);
        });
    });

    describe('getLivenessStatus', () => {
        it('should always return alive', () => {
            const liveness = manager.getLivenessStatus();

            expect(liveness.alive).toBe(true);
            expect(typeof liveness.uptime).toBe('number');
        });
    });

    describe('getUptime', () => {
        it('should return uptime in seconds', async () => {
            const uptime = manager.getUptime();
            expect(uptime).toBeGreaterThanOrEqual(0);
        });
    });
});

describe('Connector Health Check', () => {
    function createConnectorHealthCheck(
        connectorName: string,
        isConnected: () => boolean
    ): HealthCheckFunction {
        return async (): Promise<HealthCheckResult> => {
            try {
                const connected = isConnected();
                return {
                    name: `connector:${connectorName}`,
                    status: connected ? 'healthy' : 'unhealthy',
                    message: connected ? 'Connected' : 'Disconnected',
                };
            } catch (error) {
                return {
                    name: `connector:${connectorName}`,
                    status: 'unhealthy',
                    message: error instanceof Error ? error.message : 'Check failed',
                };
            }
        };
    }

    it('should return healthy when connector is connected', async () => {
        const check = createConnectorHealthCheck('database', () => true);
        const result = await check();

        expect(result.status).toBe('healthy');
        expect(result.message).toBe('Connected');
    });

    it('should return unhealthy when connector is disconnected', async () => {
        const check = createConnectorHealthCheck('database', () => false);
        const result = await check();

        expect(result.status).toBe('unhealthy');
        expect(result.message).toBe('Disconnected');
    });

    it('should handle errors in isConnected', async () => {
        const check = createConnectorHealthCheck('database', () => {
            throw new Error('Connection check failed');
        });
        const result = await check();

        expect(result.status).toBe('unhealthy');
        expect(result.message).toBe('Connection check failed');
    });
});
