/**
 * Autocannon Load Test for MCP Server
 * 
 * Usage:
 *   node load-test-autocannon.js [url] [options]
 * 
 * Options:
 *   --connections N   Number of concurrent connections (default: 10)
 *   --duration N      Duration in seconds (default: 30)
 *   --pipelining N    Number of pipelined requests (default: 1)
 */

const autocannon = require('autocannon');
const http = require('http');

const DEFAULT_URL = 'http://localhost:3000';

// Parse command line arguments
const args = process.argv.slice(2);
const url = args.find(arg => arg.startsWith('http')) || DEFAULT_URL;
const connections = parseInt(args.find(arg => arg.startsWith('--connections'))?.split('=')[1] || '10');
const duration = parseInt(args.find(arg => arg.startsWith('--duration'))?.split('=')[1] || '30');

let requestId = 0;

function createJsonRpcRequest(method, params = {}) {
  return JSON.stringify({
    jsonrpc: '2.0',
    id: ++requestId,
    method,
    params,
  });
}

// Scenario weights
const scenarios = [
  { weight: 0.4, name: 'listTools', method: 'tools/list', params: {} },
  { weight: 0.4, name: 'callTool', method: 'tools/call', params: { name: 'echo', arguments: { text: 'test' } } },
  { weight: 0.2, name: 'healthCheck', method: null }, // Special case for health endpoint
];

function selectScenario() {
  const rand = Math.random();
  let cumulative = 0;
  for (const scenario of scenarios) {
    cumulative += scenario.weight;
    if (rand < cumulative) {
      return scenario;
    }
  }
  return scenarios[0];
}

async function runLoadTest() {
  console.log(`\n🚀 Starting MCP Server Load Test`);
  console.log(`   URL: ${url}`);
  console.log(`   Connections: ${connections}`);
  console.log(`   Duration: ${duration}s\n`);

  // Check server health first
  try {
    await checkHealth();
    console.log('✅ Server health check passed\n');
  } catch (error) {
    console.error('❌ Server health check failed:', error.message);
    process.exit(1);
  }

  // Run MCP endpoint test
  const mcpResults = await runMcpTest();
  
  // Run health endpoint test
  const healthResults = await runHealthTest();
  
  // Print summary
  printSummary(mcpResults, healthResults);
}

function checkHealth() {
  return new Promise((resolve, reject) => {
    const req = http.get(`${url}/health`, (res) => {
      if (res.statusCode === 200) {
        resolve();
      } else {
        reject(new Error(`Health check returned ${res.statusCode}`));
      }
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Health check timeout'));
    });
  });
}

function runMcpTest() {
  return new Promise((resolve, reject) => {
    const instance = autocannon({
      url: `${url}/mcp`,
      connections,
      duration,
      headers: {
        'Content-Type': 'application/json',
      },
      requests: [
        {
          method: 'POST',
          body: createJsonRpcRequest('tools/list'),
        },
      ],
      setupClient: (client) => {
        client.on('response', (statusCode, bytes, responseTime) => {
          // Rotate through different request types
          const scenario = selectScenario();
          if (scenario.method) {
            client.setBody(createJsonRpcRequest(scenario.method, scenario.params));
          }
        });
      },
    }, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });

    autocannon.track(instance, { renderProgressBar: true });
  });
}

function runHealthTest() {
  return new Promise((resolve, reject) => {
    const instance = autocannon({
      url: `${url}/health`,
      connections: Math.ceil(connections / 4),
      duration: Math.ceil(duration / 2),
    }, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });

    // Don't render progress bar for health test
  });
}

function printSummary(mcpResults, healthResults) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 LOAD TEST SUMMARY');
  console.log('='.repeat(60));
  
  console.log('\n📡 MCP Endpoint (/mcp):');
  console.log(`   Requests/sec: ${mcpResults.requests.average.toFixed(2)}`);
  console.log(`   Latency avg: ${mcpResults.latency.average.toFixed(2)}ms`);
  console.log(`   Latency p99: ${mcpResults.latency.p99.toFixed(2)}ms`);
  console.log(`   Throughput: ${formatBytes(mcpResults.throughput.average)}/sec`);
  console.log(`   Errors: ${mcpResults.errors}`);
  console.log(`   Timeouts: ${mcpResults.timeouts}`);
  
  console.log('\n💓 Health Endpoint (/health):');
  console.log(`   Requests/sec: ${healthResults.requests.average.toFixed(2)}`);
  console.log(`   Latency avg: ${healthResults.latency.average.toFixed(2)}ms`);
  console.log(`   Latency p99: ${healthResults.latency.p99.toFixed(2)}ms`);
  console.log(`   Errors: ${healthResults.errors}`);
  
  // Overall assessment
  console.log('\n🎯 Assessment:');
  const mcpP99 = mcpResults.latency.p99;
  const errorRate = mcpResults.errors / mcpResults.requests.total * 100;
  
  if (mcpP99 < 100 && errorRate < 1) {
    console.log('   ✅ EXCELLENT - Low latency, minimal errors');
  } else if (mcpP99 < 500 && errorRate < 5) {
    console.log('   ✅ GOOD - Acceptable latency and error rate');
  } else if (mcpP99 < 1000 && errorRate < 10) {
    console.log('   ⚠️  WARNING - High latency or error rate');
  } else {
    console.log('   ❌ POOR - Consider optimizing the server');
  }
  
  console.log('\n' + '='.repeat(60));
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// Run the test
runLoadTest().catch((error) => {
  console.error('Load test failed:', error);
  process.exit(1);
});
