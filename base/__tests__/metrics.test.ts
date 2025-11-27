/**
 * Tests for Prometheus Metrics System Template
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Simulating the metrics template implementation

interface MetricLabels {
    [key: string]: string;
}

interface CounterValue {
    labels: MetricLabels;
    value: number;
}

interface HistogramValue {
    labels: MetricLabels;
    sum: number;
    count: number;
    buckets: Record<number, number>;
}

class Counter {
    protected name: string;
    protected help: string;
    private values: Map<string, CounterValue> = new Map();

    constructor(name: string, help: string) {
        this.name = name;
        this.help = help;
    }

    private labelsToKey(labels: MetricLabels): string {
        return JSON.stringify(labels);
    }

    inc(labels: MetricLabels = {}, value: number = 1): void {
        const key = this.labelsToKey(labels);
        const existing = this.values.get(key);

        if (existing) {
            existing.value += value;
        } else {
            this.values.set(key, { labels, value });
        }
    }

    get(labels: MetricLabels = {}): number {
        const key = this.labelsToKey(labels);
        return this.values.get(key)?.value ?? 0;
    }

    reset(): void {
        this.values.clear();
    }

    collect(): string {
        const lines: string[] = [
            `# HELP ${this.name} ${this.help}`,
            `# TYPE ${this.name} counter`,
        ];

        for (const [, entry] of this.values) {
            const labelStr = this.formatLabels(entry.labels);
            lines.push(`${this.name}${labelStr} ${entry.value}`);
        }

        return lines.join('\n');
    }

    private formatLabels(labels: MetricLabels): string {
        const entries = Object.entries(labels);
        if (entries.length === 0) return '';
        const formatted = entries.map(([key, value]) => `${key}="${value}"`).join(',');
        return `{${formatted}}`;
    }
}

class Gauge {
    protected name: string;
    protected help: string;
    private values: Map<string, { labels: MetricLabels; value: number }> = new Map();

    constructor(name: string, help: string) {
        this.name = name;
        this.help = help;
    }

    private labelsToKey(labels: MetricLabels): string {
        return JSON.stringify(labels);
    }

    set(labels: MetricLabels = {}, value: number): void {
        const key = this.labelsToKey(labels);
        this.values.set(key, { labels, value });
    }

    inc(labels: MetricLabels = {}, value: number = 1): void {
        const key = this.labelsToKey(labels);
        const existing = this.values.get(key);
        if (existing) {
            existing.value += value;
        } else {
            this.values.set(key, { labels, value });
        }
    }

    dec(labels: MetricLabels = {}, value: number = 1): void {
        this.inc(labels, -value);
    }

    get(labels: MetricLabels = {}): number {
        const key = this.labelsToKey(labels);
        return this.values.get(key)?.value ?? 0;
    }

    reset(): void {
        this.values.clear();
    }

    collect(): string {
        const lines: string[] = [
            `# HELP ${this.name} ${this.help}`,
            `# TYPE ${this.name} gauge`,
        ];

        for (const [, entry] of this.values) {
            const labelStr = this.formatLabels(entry.labels);
            lines.push(`${this.name}${labelStr} ${entry.value}`);
        }

        return lines.join('\n');
    }

    private formatLabels(labels: MetricLabels): string {
        const entries = Object.entries(labels);
        if (entries.length === 0) return '';
        const formatted = entries.map(([key, value]) => `${key}="${value}"`).join(',');
        return `{${formatted}}`;
    }
}

class Histogram {
    protected name: string;
    protected help: string;
    private values: Map<string, HistogramValue> = new Map();
    private buckets: number[];

    constructor(name: string, help: string, buckets: number[] = [0.01, 0.05, 0.1, 0.5, 1, 5, 10]) {
        this.name = name;
        this.help = help;
        this.buckets = buckets.sort((a, b) => a - b);
    }

    private labelsToKey(labels: MetricLabels): string {
        return JSON.stringify(labels);
    }

    observe(labels: MetricLabels = {}, value: number): void {
        const key = this.labelsToKey(labels);
        let existing = this.values.get(key);

        if (!existing) {
            const bucketCounts: Record<number, number> = {};
            for (const bucket of this.buckets) {
                bucketCounts[bucket] = 0;
            }
            existing = { labels, sum: 0, count: 0, buckets: bucketCounts };
            this.values.set(key, existing);
        }

        existing.sum += value;
        existing.count += 1;

        for (const bucket of this.buckets) {
            if (value <= bucket && existing.buckets[bucket] !== undefined) {
                existing.buckets[bucket] += 1;
            }
        }
    }

    startTimer(labels: MetricLabels = {}): () => number {
        const start = Date.now();
        return () => {
            const duration = (Date.now() - start) / 1000;
            this.observe(labels, duration);
            return duration;
        };
    }

    getStats(labels: MetricLabels = {}): { count: number; sum: number } | undefined {
        const key = this.labelsToKey(labels);
        const entry = this.values.get(key);
        if (!entry) return undefined;
        return { count: entry.count, sum: entry.sum };
    }

    reset(): void {
        this.values.clear();
    }
}

describe('Counter', () => {
    let counter: Counter;

    beforeEach(() => {
        counter = new Counter('test_counter', 'A test counter');
    });

    it('should start at zero', () => {
        expect(counter.get()).toBe(0);
    });

    it('should increment by 1 by default', () => {
        counter.inc();
        expect(counter.get()).toBe(1);
    });

    it('should increment by specified value', () => {
        counter.inc({}, 5);
        expect(counter.get()).toBe(5);
    });

    it('should support labels', () => {
        counter.inc({ method: 'GET' });
        counter.inc({ method: 'POST' });
        counter.inc({ method: 'GET' });

        expect(counter.get({ method: 'GET' })).toBe(2);
        expect(counter.get({ method: 'POST' })).toBe(1);
    });

    it('should reset all values', () => {
        counter.inc({ method: 'GET' }, 10);
        counter.inc({ method: 'POST' }, 5);
        counter.reset();

        expect(counter.get({ method: 'GET' })).toBe(0);
        expect(counter.get({ method: 'POST' })).toBe(0);
    });

    it('should collect in Prometheus format', () => {
        counter.inc({ method: 'GET' }, 10);
        const output = counter.collect();

        expect(output).toContain('# HELP test_counter A test counter');
        expect(output).toContain('# TYPE test_counter counter');
        expect(output).toContain('test_counter{method="GET"} 10');
    });
});

describe('Gauge', () => {
    let gauge: Gauge;

    beforeEach(() => {
        gauge = new Gauge('test_gauge', 'A test gauge');
    });

    it('should start at zero', () => {
        expect(gauge.get()).toBe(0);
    });

    it('should set value', () => {
        gauge.set({}, 42);
        expect(gauge.get()).toBe(42);
    });

    it('should increment', () => {
        gauge.set({}, 10);
        gauge.inc({}, 5);
        expect(gauge.get()).toBe(15);
    });

    it('should decrement', () => {
        gauge.set({}, 10);
        gauge.dec({}, 3);
        expect(gauge.get()).toBe(7);
    });

    it('should support labels', () => {
        gauge.set({ connector: 'db' }, 1);
        gauge.set({ connector: 'cache' }, 0);

        expect(gauge.get({ connector: 'db' })).toBe(1);
        expect(gauge.get({ connector: 'cache' })).toBe(0);
    });

    it('should collect in Prometheus format', () => {
        gauge.set({ connector: 'database' }, 1);
        const output = gauge.collect();

        expect(output).toContain('# HELP test_gauge A test gauge');
        expect(output).toContain('# TYPE test_gauge gauge');
        expect(output).toContain('test_gauge{connector="database"} 1');
    });
});

describe('Histogram', () => {
    let histogram: Histogram;

    beforeEach(() => {
        histogram = new Histogram('test_histogram', 'A test histogram', [0.1, 0.5, 1, 5]);
    });

    it('should observe values', () => {
        histogram.observe({}, 0.2);
        histogram.observe({}, 0.8);
        histogram.observe({}, 2);

        const stats = histogram.getStats();
        expect(stats?.count).toBe(3);
        expect(stats?.sum).toBeCloseTo(3, 1);
    });

    it('should support labels', () => {
        histogram.observe({ tool: 'summarize' }, 0.5);
        histogram.observe({ tool: 'translate' }, 1.0);

        const summarizeStats = histogram.getStats({ tool: 'summarize' });
        const translateStats = histogram.getStats({ tool: 'translate' });

        expect(summarizeStats?.count).toBe(1);
        expect(translateStats?.count).toBe(1);
    });

    it('should provide timer function', async () => {
        const stopTimer = histogram.startTimer({ operation: 'test' });

        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 50));

        const duration = stopTimer();
        expect(duration).toBeGreaterThan(0);

        const stats = histogram.getStats({ operation: 'test' });
        expect(stats?.count).toBe(1);
        expect(stats?.sum).toBeGreaterThan(0);
    });

    it('should reset all values', () => {
        histogram.observe({ tool: 'test' }, 0.5);
        histogram.reset();

        const stats = histogram.getStats({ tool: 'test' });
        expect(stats).toBeUndefined();
    });
});

describe('MetricsRegistry', () => {
    class MetricsRegistry {
        private metrics: Map<string, Counter | Gauge | Histogram> = new Map();
        private prefix: string;

        constructor(prefix: string = 'mcp') {
            this.prefix = prefix;
        }

        createCounter(name: string, help: string): Counter {
            const fullName = `${this.prefix}_${name}`;
            const counter = new Counter(fullName, help);
            this.metrics.set(fullName, counter);
            return counter;
        }

        createGauge(name: string, help: string): Gauge {
            const fullName = `${this.prefix}_${name}`;
            const gauge = new Gauge(fullName, help);
            this.metrics.set(fullName, gauge);
            return gauge;
        }

        createHistogram(name: string, help: string, buckets?: number[]): Histogram {
            const fullName = `${this.prefix}_${name}`;
            const histogram = new Histogram(fullName, help, buckets);
            this.metrics.set(fullName, histogram);
            return histogram;
        }

        collect(): string {
            const sections: string[] = [];
            for (const metric of this.metrics.values()) {
                if ('collect' in metric && typeof metric.collect === 'function') {
                    const output = (metric as Counter | Gauge).collect();
                    if (output) {
                        sections.push(output);
                    }
                }
            }
            return sections.join('\n\n') + '\n';
        }
    }

    it('should create metrics with prefix', () => {
        const registry = new MetricsRegistry('myapp');
        const counter = registry.createCounter('requests', 'Request count');

        counter.inc();
        const output = registry.collect();

        expect(output).toContain('myapp_requests');
    });

    it('should collect all metrics', () => {
        const registry = new MetricsRegistry('test');

        const counter = registry.createCounter('counter', 'A counter');
        const gauge = registry.createGauge('gauge', 'A gauge');

        counter.inc();
        gauge.set({}, 42);

        const output = registry.collect();

        expect(output).toContain('test_counter');
        expect(output).toContain('test_gauge');
    });
});
