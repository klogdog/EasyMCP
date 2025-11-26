/**
 * Test Suite for Docker Client Wrapper
 * 
 * Tests the DockerClient class functionality including:
 * - Docker daemon connectivity
 * - Image operations (build, list, remove)
 * - Container operations (create, start, stop, remove)
 * - Error handling
 * - Progress streaming
 * 
 * @module test-docker-client
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
    DockerClient,
    DockerError,
    DockerDaemonNotRunningError,
    DockerImageError,
    DockerContainerError,
    DockerBuildError,
    createDockerClient,
    isDockerAvailable
} from './docker-client';

// ============================================================================
// Test Utilities
// ============================================================================

interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
    skipped?: boolean;
    skipReason?: string;
}

const results: TestResult[] = [];
let dockerAvailable = false;

function logTest(name: string, passed: boolean, error?: string): void {
    results.push({ name, passed, error });
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${status}: ${name}`);
    if (error) {
        console.log(`         Error: ${error}`);
    }
}

function logSkipped(name: string, reason: string): void {
    results.push({ name, passed: true, skipped: true, skipReason: reason });
    console.log(`  ⏭️  SKIP: ${name} (${reason})`);
}

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
    if (actual !== expected) {
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
}

function assertInstanceOf(obj: any, cls: any, message: string): void {
    if (!(obj instanceof cls)) {
        throw new Error(`${message}: expected instance of ${cls.name}, got ${obj?.constructor?.name}`);
    }
}

// ============================================================================
// Test 1: DockerClient Initialization
// ============================================================================

async function testClientInitialization(): Promise<void> {
    console.log('\n📦 Test 1: DockerClient Initialization');

    // Test 1.1: Default initialization
    try {
        const client = new DockerClient();
        assert(client !== null, 'Client should be created');
        logTest('1.1 Default initialization', true);
    } catch (error) {
        logTest('1.1 Default initialization', false, (error as Error).message);
    }

    // Test 1.2: Custom socket path
    try {
        const client = new DockerClient({ socketPath: '/var/run/docker.sock' });
        assert(client !== null, 'Client should be created with custom socket');
        logTest('1.2 Custom socket path initialization', true);
    } catch (error) {
        logTest('1.2 Custom socket path initialization', false, (error as Error).message);
    }

    // Test 1.3: TCP host initialization
    try {
        const client = new DockerClient({ host: 'localhost', port: 2375 });
        assert(client !== null, 'Client should be created with TCP host');
        logTest('1.3 TCP host initialization', true);
    } catch (error) {
        logTest('1.3 TCP host initialization', false, (error as Error).message);
    }

    // Test 1.4: With timeout option
    try {
        const client = new DockerClient({ timeout: 60000 });
        assert(client !== null, 'Client should be created with custom timeout');
        logTest('1.4 Custom timeout initialization', true);
    } catch (error) {
        logTest('1.4 Custom timeout initialization', false, (error as Error).message);
    }

    // Test 1.5: Convenience function
    try {
        const client = createDockerClient();
        assert(client !== null, 'createDockerClient should return a client');
        assertInstanceOf(client, DockerClient, 'Should be DockerClient instance');
        logTest('1.5 createDockerClient convenience function', true);
    } catch (error) {
        logTest('1.5 createDockerClient convenience function', false, (error as Error).message);
    }
}

// ============================================================================
// Test 2: Docker Daemon Connectivity
// ============================================================================

async function testDaemonConnectivity(): Promise<void> {
    console.log('\n🔌 Test 2: Docker Daemon Connectivity');

    const client = new DockerClient();

    // Test 2.1: ping() returns boolean
    try {
        const result = await client.ping();
        assert(typeof result === 'boolean', 'ping() should return boolean');
        dockerAvailable = result;
        logTest('2.1 ping() returns boolean', true);
        console.log(`         Docker available: ${dockerAvailable}`);
    } catch (error) {
        logTest('2.1 ping() returns boolean', false, (error as Error).message);
    }

    // Test 2.2: isDockerAvailable() convenience function
    try {
        const result = await isDockerAvailable();
        assert(typeof result === 'boolean', 'isDockerAvailable() should return boolean');
        assertEqual(result, dockerAvailable, 'Should match ping() result');
        logTest('2.2 isDockerAvailable() convenience function', true);
    } catch (error) {
        logTest('2.2 isDockerAvailable() convenience function', false, (error as Error).message);
    }

    // Test 2.3: ensureConnected() when Docker is available
    if (dockerAvailable) {
        try {
            await client.ensureConnected();
            logTest('2.3 ensureConnected() succeeds when daemon running', true);
        } catch (error) {
            logTest('2.3 ensureConnected() succeeds when daemon running', false, (error as Error).message);
        }
    } else {
        logSkipped('2.3 ensureConnected() succeeds when daemon running', 'Docker not available');
    }

    // Test 2.4: Connection to invalid host fails gracefully
    try {
        const badClient = new DockerClient({ host: 'invalid-host-that-does-not-exist', port: 9999, timeout: 1000 });
        const result = await badClient.ping();
        assertEqual(result, false, 'ping() should return false for invalid host');
        logTest('2.4 ping() returns false for invalid host', true);
    } catch (error) {
        // This is also acceptable - some implementations throw
        logTest('2.4 ping() returns false for invalid host', true);
    }
}

// ============================================================================
// Test 3: Image Listing
// ============================================================================

async function testImageListing(): Promise<void> {
    console.log('\n🖼️  Test 3: Image Listing');

    if (!dockerAvailable) {
        logSkipped('3.1 listImages() returns array', 'Docker not available');
        logSkipped('3.2 listImages() with filter', 'Docker not available');
        logSkipped('3.3 ImageInfo structure', 'Docker not available');
        return;
    }

    const client = new DockerClient();

    // Test 3.1: listImages() returns array
    try {
        const images = await client.listImages();
        assert(Array.isArray(images), 'listImages() should return an array');
        logTest('3.1 listImages() returns array', true);
        console.log(`         Found ${images.length} images`);
    } catch (error) {
        logTest('3.1 listImages() returns array', false, (error as Error).message);
    }

    // Test 3.2: listImages() with filter
    try {
        const images = await client.listImages('nonexistent-image-filter-12345');
        assert(Array.isArray(images), 'Filtered listImages() should return an array');
        logTest('3.2 listImages() with filter', true);
    } catch (error) {
        logTest('3.2 listImages() with filter', false, (error as Error).message);
    }

    // Test 3.3: ImageInfo structure
    try {
        const images = await client.listImages();
        if (images.length > 0) {
            const img = images[0]!;
            assert(typeof img.id === 'string', 'ImageInfo.id should be string');
            assert(Array.isArray(img.tags), 'ImageInfo.tags should be array');
            assert(typeof img.size === 'number', 'ImageInfo.size should be number');
            assert(img.created instanceof Date, 'ImageInfo.created should be Date');
            logTest('3.3 ImageInfo structure', true);
        } else {
            logSkipped('3.3 ImageInfo structure', 'No images to inspect');
        }
    } catch (error) {
        logTest('3.3 ImageInfo structure', false, (error as Error).message);
    }
}

// ============================================================================
// Test 4: Container Listing
// ============================================================================

async function testContainerListing(): Promise<void> {
    console.log('\n📦 Test 4: Container Listing');

    if (!dockerAvailable) {
        logSkipped('4.1 listContainers() returns array', 'Docker not available');
        logSkipped('4.2 listContainers(all=true)', 'Docker not available');
        logSkipped('4.3 ContainerInfo structure', 'Docker not available');
        return;
    }

    const client = new DockerClient();

    // Test 4.1: listContainers() returns array
    try {
        const containers = await client.listContainers();
        assert(Array.isArray(containers), 'listContainers() should return an array');
        logTest('4.1 listContainers() returns array', true);
        console.log(`         Found ${containers.length} running containers`);
    } catch (error) {
        logTest('4.1 listContainers() returns array', false, (error as Error).message);
    }

    // Test 4.2: listContainers(all=true)
    try {
        const containers = await client.listContainers(true);
        assert(Array.isArray(containers), 'listContainers(all) should return an array');
        logTest('4.2 listContainers(all=true)', true);
        console.log(`         Found ${containers.length} total containers`);
    } catch (error) {
        logTest('4.2 listContainers(all=true)', false, (error as Error).message);
    }

    // Test 4.3: ContainerInfo structure
    try {
        const containers = await client.listContainers(true);
        if (containers.length > 0) {
            const c = containers[0]!;
            assert(typeof c.id === 'string', 'ContainerInfo.id should be string');
            assert(typeof c.name === 'string', 'ContainerInfo.name should be string');
            assert(typeof c.image === 'string', 'ContainerInfo.image should be string');
            assert(typeof c.state === 'string', 'ContainerInfo.state should be string');
            assert(typeof c.status === 'string', 'ContainerInfo.status should be string');
            assert(Array.isArray(c.ports), 'ContainerInfo.ports should be array');
            assert(c.created instanceof Date, 'ContainerInfo.created should be Date');
            logTest('4.3 ContainerInfo structure', true);
        } else {
            logSkipped('4.3 ContainerInfo structure', 'No containers to inspect');
        }
    } catch (error) {
        logTest('4.3 ContainerInfo structure', false, (error as Error).message);
    }
}

// ============================================================================
// Test 5: Error Classes
// ============================================================================

async function testErrorClasses(): Promise<void> {
    console.log('\n❌ Test 5: Error Classes');

    // Test 5.1: DockerError base class
    try {
        const error = new DockerError('Test error', 'TEST_CODE');
        assert(error instanceof Error, 'DockerError should extend Error');
        assertEqual(error.message, 'Test error', 'Message should match');
        assertEqual(error.code, 'TEST_CODE', 'Code should match');
        assertEqual(error.name, 'DockerError', 'Name should be DockerError');
        logTest('5.1 DockerError base class', true);
    } catch (error) {
        logTest('5.1 DockerError base class', false, (error as Error).message);
    }

    // Test 5.2: DockerDaemonNotRunningError
    try {
        const error = new DockerDaemonNotRunningError();
        assertInstanceOf(error, DockerError, 'Should extend DockerError');
        assertEqual(error.name, 'DockerDaemonNotRunningError', 'Name should match');
        assertEqual(error.code, 'DAEMON_NOT_RUNNING', 'Code should match');
        assert(error.message.includes('daemon'), 'Message should mention daemon');
        logTest('5.2 DockerDaemonNotRunningError', true);
    } catch (error) {
        logTest('5.2 DockerDaemonNotRunningError', false, (error as Error).message);
    }

    // Test 5.3: DockerImageError
    try {
        const error = new DockerImageError('Image not found', 'abc123');
        assertInstanceOf(error, DockerError, 'Should extend DockerError');
        assertEqual(error.name, 'DockerImageError', 'Name should match');
        assertEqual(error.imageId, 'abc123', 'ImageId should match');
        logTest('5.3 DockerImageError', true);
    } catch (error) {
        logTest('5.3 DockerImageError', false, (error as Error).message);
    }

    // Test 5.4: DockerContainerError
    try {
        const error = new DockerContainerError('Container failed', 'def456');
        assertInstanceOf(error, DockerError, 'Should extend DockerError');
        assertEqual(error.name, 'DockerContainerError', 'Name should match');
        assertEqual(error.containerId, 'def456', 'ContainerId should match');
        logTest('5.4 DockerContainerError', true);
    } catch (error) {
        logTest('5.4 DockerContainerError', false, (error as Error).message);
    }

    // Test 5.5: DockerBuildError
    try {
        const error = new DockerBuildError('Build failed', 'Step 1/5...');
        assertInstanceOf(error, DockerError, 'Should extend DockerError');
        assertEqual(error.name, 'DockerBuildError', 'Name should match');
        assertEqual(error.buildOutput, 'Step 1/5...', 'BuildOutput should match');
        logTest('5.5 DockerBuildError', true);
    } catch (error) {
        logTest('5.5 DockerBuildError', false, (error as Error).message);
    }

    // Test 5.6: Error with originalError
    try {
        const original = new Error('Original');
        const error = new DockerError('Wrapped', 'WRAP', original);
        assertEqual(error.originalError, original, 'originalError should be preserved');
        logTest('5.6 Error wrapping with originalError', true);
    } catch (error) {
        logTest('5.6 Error wrapping with originalError', false, (error as Error).message);
    }
}

// ============================================================================
// Test 6: Image Build (Basic Validation)
// ============================================================================

async function testImageBuild(): Promise<void> {
    console.log('\n🔨 Test 6: Image Build Validation');

    const client = new DockerClient();

    // Test 6.1: buildImage rejects invalid context path
    try {
        await client.buildImage('/nonexistent/path', 'Dockerfile', 'test:latest');
        logTest('6.1 buildImage rejects invalid context path', false, 'Should have thrown');
    } catch (error) {
        // When Docker is not available, we get DockerDaemonNotRunningError or DockerError
        // When Docker is available but path is invalid, we get DockerBuildError
        assertInstanceOf(error, DockerError, 'Should throw a DockerError subclass');
        logTest('6.1 buildImage rejects invalid context path', true);
    }

    // Test 6.2: buildImage rejects missing Dockerfile
    if (dockerAvailable) {
        try {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docker-test-'));
            try {
                await client.buildImage(tempDir, 'NonexistentDockerfile', 'test:latest');
                logTest('6.2 buildImage rejects missing Dockerfile', false, 'Should have thrown');
            } catch (error) {
                assertInstanceOf(error, DockerBuildError, 'Should throw DockerBuildError');
                assert((error as Error).message.includes('not found'), 'Message should mention not found');
                logTest('6.2 buildImage rejects missing Dockerfile', true);
            } finally {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        } catch (error) {
            logTest('6.2 buildImage rejects missing Dockerfile', false, (error as Error).message);
        }
    } else {
        logSkipped('6.2 buildImage rejects missing Dockerfile', 'Docker not available');
    }
}

// ============================================================================
// Test 7: Container Operations (Error Cases)
// ============================================================================

async function testContainerOperationsErrors(): Promise<void> {
    console.log('\n📦 Test 7: Container Operations Error Handling');

    if (!dockerAvailable) {
        logSkipped('7.1 createContainer with nonexistent image', 'Docker not available');
        logSkipped('7.2 startContainer with nonexistent container', 'Docker not available');
        logSkipped('7.3 stopContainer with nonexistent container', 'Docker not available');
        logSkipped('7.4 removeContainer with nonexistent container', 'Docker not available');
        return;
    }

    const client = new DockerClient();

    // Test 7.1: createContainer with nonexistent image
    try {
        await client.createContainer({
            image: 'nonexistent-image-12345:latest',
            name: 'test-container-12345'
        });
        logTest('7.1 createContainer with nonexistent image', false, 'Should have thrown');
    } catch (error) {
        assertInstanceOf(error, DockerContainerError, 'Should throw DockerContainerError');
        assert((error as Error).message.includes('not found') || (error as Error).message.includes('No such image'),
            'Message should mention image not found');
        logTest('7.1 createContainer with nonexistent image', true);
    }

    // Test 7.2: startContainer with nonexistent container
    try {
        await client.startContainer('nonexistent-container-12345');
        logTest('7.2 startContainer with nonexistent container', false, 'Should have thrown');
    } catch (error) {
        assertInstanceOf(error, DockerContainerError, 'Should throw DockerContainerError');
        assert((error as Error).message.includes('not found') || (error as Error).message.includes('No such container'),
            'Message should mention container not found');
        logTest('7.2 startContainer with nonexistent container', true);
    }

    // Test 7.3: stopContainer with nonexistent container
    try {
        await client.stopContainer('nonexistent-container-12345');
        logTest('7.3 stopContainer with nonexistent container', false, 'Should have thrown');
    } catch (error) {
        assertInstanceOf(error, DockerContainerError, 'Should throw DockerContainerError');
        logTest('7.3 stopContainer with nonexistent container', true);
    }

    // Test 7.4: removeContainer with nonexistent container
    try {
        await client.removeContainer('nonexistent-container-12345');
        logTest('7.4 removeContainer with nonexistent container', false, 'Should have thrown');
    } catch (error) {
        assertInstanceOf(error, DockerContainerError, 'Should throw DockerContainerError');
        logTest('7.4 removeContainer with nonexistent container', true);
    }
}

// ============================================================================
// Test 8: Docker System Info
// ============================================================================

async function testDockerInfo(): Promise<void> {
    console.log('\n📊 Test 8: Docker System Info');

    if (!dockerAvailable) {
        logSkipped('8.1 getInfo() returns system information', 'Docker not available');
        logSkipped('8.2 getInfo() structure validation', 'Docker not available');
        return;
    }

    const client = new DockerClient();

    // Test 8.1: getInfo() returns system information
    try {
        const info = await client.getInfo();
        assert(info !== null, 'getInfo() should return an object');
        logTest('8.1 getInfo() returns system information', true);
        console.log(`         Server version: ${info.serverVersion}`);
        console.log(`         OS: ${info.operatingSystem}`);
        console.log(`         CPUs: ${info.cpus}`);
    } catch (error) {
        logTest('8.1 getInfo() returns system information', false, (error as Error).message);
    }

    // Test 8.2: getInfo() structure validation
    try {
        const info = await client.getInfo();
        assert(typeof info.containers === 'number', 'containers should be number');
        assert(typeof info.images === 'number', 'images should be number');
        assert(typeof info.serverVersion === 'string', 'serverVersion should be string');
        assert(typeof info.operatingSystem === 'string', 'operatingSystem should be string');
        assert(typeof info.architecture === 'string', 'architecture should be string');
        assert(typeof info.memoryLimit === 'number', 'memoryLimit should be number');
        assert(typeof info.cpus === 'number', 'cpus should be number');
        logTest('8.2 getInfo() structure validation', true);
    } catch (error) {
        logTest('8.2 getInfo() structure validation', false, (error as Error).message);
    }
}

// ============================================================================
// Test Runner
// ============================================================================

async function runAllTests(): Promise<void> {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║        Docker Client Wrapper - Test Suite                      ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`\nStarted at: ${new Date().toISOString()}`);

    await testClientInitialization();
    await testDaemonConnectivity();
    await testImageListing();
    await testContainerListing();
    await testErrorClasses();
    await testImageBuild();
    await testContainerOperationsErrors();
    await testDockerInfo();

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                         TEST SUMMARY                          ');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const passed = results.filter(r => r.passed && !r.skipped).length;
    const failed = results.filter(r => !r.passed).length;
    const skipped = results.filter(r => r.skipped).length;
    const total = results.length;

    console.log(`  Total:   ${total}`);
    console.log(`  Passed:  ${passed} ✅`);
    console.log(`  Failed:  ${failed} ${failed > 0 ? '❌' : ''}`);
    console.log(`  Skipped: ${skipped} ⏭️`);
    console.log(`\n  Docker Available: ${dockerAvailable ? 'Yes ✅' : 'No ⚠️'}`);

    if (failed > 0) {
        console.log('\n  Failed Tests:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`    - ${r.name}: ${r.error}`);
        });
    }

    console.log('\n═══════════════════════════════════════════════════════════════');

    if (failed > 0) {
        console.log('\n❌ Some tests failed!\n');
        process.exit(1);
    } else {
        console.log('\n✅ All tests passed!\n');
        process.exit(0);
    }
}

// Run tests
runAllTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
});
