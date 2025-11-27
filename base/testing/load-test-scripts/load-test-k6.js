/**
 * k6 Load Test Script for MCP Server
 * 
 * Usage:
 *   k6 run --vus 10 --duration 30s load-test-k6.js
 * 
 * Environment variables:
 *   MCP_SERVER_URL - Base URL of the MCP server (default: http://localhost:3000)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const toolInvocations = new Counter('mcp_tool_invocations');
const errorRate = new Rate('mcp_error_rate');
const toolDuration = new Trend('mcp_tool_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 20 },  // Ramp up to 20 users
    { duration: '1m', target: 20 },   // Stay at 20 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    mcp_error_rate: ['rate<0.05'],     // Error rate under 5%
    http_req_failed: ['rate<0.01'],    // HTTP failures under 1%
  },
};

const BASE_URL = __ENV.MCP_SERVER_URL || 'http://localhost:3000';

// Initialize MCP connection
let requestId = 0;

function jsonRpcRequest(method, params = {}) {
  requestId++;
  return JSON.stringify({
    jsonrpc: '2.0',
    id: requestId,
    method: method,
    params: params,
  });
}

// Test scenarios
export default function() {
  const scenario = Math.random();
  
  if (scenario < 0.4) {
    // 40%: List tools
    testListTools();
  } else if (scenario < 0.8) {
    // 40%: Call tool
    testCallTool();
  } else {
    // 20%: Health check
    testHealthCheck();
  }
  
  sleep(0.1); // 100ms between requests
}

function testHealthCheck() {
  const res = http.get(`${BASE_URL}/health`);
  
  check(res, {
    'health check status is 200': (r) => r.status === 200,
    'health check has status ok': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'ok' || body.status === 'degraded';
      } catch {
        return false;
      }
    },
  });
}

function testListTools() {
  const payload = jsonRpcRequest('tools/list');
  
  const res = http.post(`${BASE_URL}/mcp`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  
  const isSuccess = check(res, {
    'list tools status is 200': (r) => r.status === 200,
    'list tools returns array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.result && Array.isArray(body.result.tools);
      } catch {
        return false;
      }
    },
  });
  
  errorRate.add(!isSuccess);
}

function testCallTool() {
  const startTime = Date.now();
  
  // Call a simple tool (adjust based on your server's tools)
  const payload = jsonRpcRequest('tools/call', {
    name: 'echo',
    arguments: { text: 'test message' },
  });
  
  const res = http.post(`${BASE_URL}/mcp`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  
  const duration = Date.now() - startTime;
  toolDuration.add(duration);
  toolInvocations.add(1);
  
  const isSuccess = check(res, {
    'call tool status is 200': (r) => r.status === 200,
    'call tool has result or error': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.result !== undefined || body.error !== undefined;
      } catch {
        return false;
      }
    },
  });
  
  errorRate.add(!isSuccess);
}

// Setup: Initialize connection (runs once per VU)
export function setup() {
  // Verify server is reachable
  const res = http.get(`${BASE_URL}/health`);
  if (res.status !== 200) {
    throw new Error(`Server not healthy: ${res.status}`);
  }
  
  // Initialize MCP connection
  const initPayload = jsonRpcRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'k6-load-test', version: '1.0.0' },
  });
  
  const initRes = http.post(`${BASE_URL}/mcp`, initPayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (initRes.status !== 200) {
    throw new Error(`Failed to initialize: ${initRes.status}`);
  }
  
  return { initialized: true };
}

// Teardown: Clean up (runs once after all VUs complete)
export function teardown(data) {
  console.log('Load test completed');
  console.log(`Initialized: ${data.initialized}`);
}
