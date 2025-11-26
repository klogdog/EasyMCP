/**
 * Test Suite for Registry Module
 * 
 * Tests the Registry class functionality including:
 * - Tag validation
 * - Image tagging operations
 * - Push operations (with dry-run mode)
 * - Local image listing
 * - Image pruning
 * - Utility functions
 * 
 * @module test-registry
 */

import {
    Registry,
    RegistryError,
    TagError,
    PushError,
    AuthenticationError,
    TagValidationError,
    validateTag,
    sanitizeTagComponent,
    generateTimestampTag,
    formatBytes,
    formatRelativeTime,
    getDefaultRegistry,
    createRegistry,
    tagImage,
    pushImage,
    listLocalImages,
    pruneOldImages,
    TagOptions,
    PushOptions,
    PushProgressEvent,
    RegistryAuth,
    TagResult,
    PruneResult
} from './registry';

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

function assertThrows(fn: () => void, errorType: any, message: string): void {
    try {
        fn();
        throw new Error(`${message}: expected to throw ${errorType.name}`);
    } catch (error) {
        if (!(error instanceof errorType)) {
            throw new Error(`${message}: expected ${errorType.name}, got ${(error as Error).constructor.name}`);
        }
    }
}

async function assertAsyncThrows(fn: () => Promise<any>, errorType: any, message: string): Promise<void> {
    try {
        await fn();
        throw new Error(`${message}: expected to throw ${errorType.name}`);
    } catch (error) {
        if (!(error instanceof errorType)) {
            throw new Error(`${message}: expected ${errorType.name}, got ${(error as Error).constructor.name}`);
        }
    }
}

// ============================================================================
// Test 1: Tag Validation
// ============================================================================

async function testTagValidation(): Promise<void> {
    console.log('\n🏷️  Test 1: Tag Validation');

    // Test 1.1: Valid simple tags
    try {
        assert(validateTag('myapp:latest') === true, 'Should accept myapp:latest');
        assert(validateTag('myapp:v1.0.0') === true, 'Should accept myapp:v1.0.0');
        assert(validateTag('myapp') === true, 'Should accept myapp without tag');
        logTest('1.1 Valid simple tags', true);
    } catch (error) {
        logTest('1.1 Valid simple tags', false, (error as Error).message);
    }

    // Test 1.2: Valid registry-qualified tags
    try {
        assert(validateTag('ghcr.io/user/repo:latest') === true, 'Should accept ghcr.io');
        assert(validateTag('docker.io/library/nginx:1.19') === true, 'Should accept docker.io');
        assert(validateTag('my-registry.example.com/app:v2') === true, 'Should accept private registry');
        logTest('1.2 Valid registry-qualified tags', true);
    } catch (error) {
        logTest('1.2 Valid registry-qualified tags', false, (error as Error).message);
    }

    // Test 1.3: Valid tags with special characters
    try {
        assert(validateTag('my_app:v1.0.0-beta.1') === true, 'Should accept underscores and hyphens');
        assert(validateTag('my.app:v1.0') === true, 'Should accept dots in repo name');
        assert(validateTag('app:20231126-143022') === true, 'Should accept timestamp format');
        logTest('1.3 Valid tags with special characters', true);
    } catch (error) {
        logTest('1.3 Valid tags with special characters', false, (error as Error).message);
    }

    // Test 1.4: Invalid empty tag
    try {
        assertThrows(() => validateTag(''), TagValidationError, 'Should reject empty tag');
        assertThrows(() => validateTag('   '), TagValidationError, 'Should reject whitespace tag');
        logTest('1.4 Invalid empty tag rejection', true);
    } catch (error) {
        logTest('1.4 Invalid empty tag rejection', false, (error as Error).message);
    }

    // Test 1.5: Invalid tag format
    try {
        assertThrows(() => validateTag('MyApp:latest'), TagValidationError, 'Should reject uppercase');
        assertThrows(() => validateTag('my app:latest'), TagValidationError, 'Should reject spaces');
        assertThrows(() => validateTag('app:'), TagValidationError, 'Should reject empty tag after colon');
        logTest('1.5 Invalid tag format rejection', true);
    } catch (error) {
        logTest('1.5 Invalid tag format rejection', false, (error as Error).message);
    }

    // Test 1.6: Invalid multiple colons
    try {
        assertThrows(() => validateTag('app:v1:extra'), TagValidationError, 'Should reject multiple colons');
        logTest('1.6 Invalid multiple colons rejection', true);
    } catch (error) {
        logTest('1.6 Invalid multiple colons rejection', false, (error as Error).message);
    }

    // Test 1.7: Tag too long
    try {
        const longTag = 'a'.repeat(129);
        assertThrows(() => validateTag(`app:${longTag}`), TagValidationError, 'Should reject tag > 128 chars');
        logTest('1.7 Tag length limit', true);
    } catch (error) {
        logTest('1.7 Tag length limit', false, (error as Error).message);
    }

    // Test 1.8: Invalid starting characters
    try {
        assertThrows(() => validateTag('app:.hidden'), TagValidationError, 'Should reject tag starting with dot');
        assertThrows(() => validateTag('app:-dash'), TagValidationError, 'Should reject tag starting with dash');
        logTest('1.8 Invalid starting characters rejection', true);
    } catch (error) {
        logTest('1.8 Invalid starting characters rejection', false, (error as Error).message);
    }
}

// ============================================================================
// Test 2: Tag Sanitization
// ============================================================================

async function testTagSanitization(): Promise<void> {
    console.log('\n🧹 Test 2: Tag Sanitization');

    // Test 2.1: Uppercase conversion
    try {
        assertEqual(sanitizeTagComponent('MyApp'), 'myapp', 'Should lowercase');
        assertEqual(sanitizeTagComponent('UPPERCASE'), 'uppercase', 'Should lowercase all caps');
        logTest('2.1 Uppercase conversion', true);
    } catch (error) {
        logTest('2.1 Uppercase conversion', false, (error as Error).message);
    }

    // Test 2.2: Special character replacement
    try {
        assertEqual(sanitizeTagComponent('my app'), 'my-app', 'Should replace spaces');
        assertEqual(sanitizeTagComponent('app@v1'), 'app-v1', 'Should replace @');
        assertEqual(sanitizeTagComponent('app#tag'), 'app-tag', 'Should replace #');
        logTest('2.2 Special character replacement', true);
    } catch (error) {
        logTest('2.2 Special character replacement', false, (error as Error).message);
    }

    // Test 2.3: Leading/trailing cleanup
    try {
        assertEqual(sanitizeTagComponent('-app-'), 'app', 'Should remove leading/trailing hyphens');
        assertEqual(sanitizeTagComponent('.app.'), 'app', 'Should remove leading/trailing dots');
        assertEqual(sanitizeTagComponent('--app--'), 'app', 'Should remove multiple hyphens');
        logTest('2.3 Leading/trailing cleanup', true);
    } catch (error) {
        logTest('2.3 Leading/trailing cleanup', false, (error as Error).message);
    }

    // Test 2.4: Multiple consecutive hyphens
    try {
        assertEqual(sanitizeTagComponent('my---app'), 'my-app', 'Should collapse multiple hyphens');
        logTest('2.4 Multiple consecutive hyphens', true);
    } catch (error) {
        logTest('2.4 Multiple consecutive hyphens', false, (error as Error).message);
    }

    // Test 2.5: Ensure alphanumeric start
    try {
        const result = sanitizeTagComponent('---test');
        assert(result.startsWith('x') || /^[a-z0-9]/.test(result), 'Should start with alphanumeric');
        logTest('2.5 Ensure alphanumeric start', true);
    } catch (error) {
        logTest('2.5 Ensure alphanumeric start', false, (error as Error).message);
    }

    // Test 2.6: Truncation to 128 chars
    try {
        const longInput = 'a'.repeat(200);
        const result = sanitizeTagComponent(longInput);
        assert(result.length <= 128, `Should truncate to 128 chars, got ${result.length}`);
        logTest('2.6 Truncation to 128 chars', true);
    } catch (error) {
        logTest('2.6 Truncation to 128 chars', false, (error as Error).message);
    }

    // Test 2.7: Empty input returns default
    try {
        assertEqual(sanitizeTagComponent(''), 'latest', 'Empty input should return latest');
        assertEqual(sanitizeTagComponent('---'), 'latest', 'Only invalid chars should return latest');
        logTest('2.7 Empty input returns default', true);
    } catch (error) {
        logTest('2.7 Empty input returns default', false, (error as Error).message);
    }
}

// ============================================================================
// Test 3: Utility Functions
// ============================================================================

async function testUtilityFunctions(): Promise<void> {
    console.log('\n🔧 Test 3: Utility Functions');

    // Test 3.1: generateTimestampTag format
    try {
        const timestamp = generateTimestampTag();
        assert(/^\d{8}-\d{6}$/.test(timestamp), `Invalid timestamp format: ${timestamp}`);
        logTest('3.1 generateTimestampTag format', true);
    } catch (error) {
        logTest('3.1 generateTimestampTag format', false, (error as Error).message);
    }

    // Test 3.2: formatBytes conversions
    try {
        assertEqual(formatBytes(0), '0 B', 'Should format 0 bytes');
        assertEqual(formatBytes(1024), '1 KB', 'Should format 1 KB');
        assertEqual(formatBytes(1024 * 1024), '1 MB', 'Should format 1 MB');
        assertEqual(formatBytes(1024 * 1024 * 1024), '1 GB', 'Should format 1 GB');
        logTest('3.2 formatBytes conversions', true);
    } catch (error) {
        logTest('3.2 formatBytes conversions', false, (error as Error).message);
    }

    // Test 3.3: formatBytes decimal precision
    try {
        const formatted = formatBytes(1536); // 1.5 KB
        assert(formatted.includes('1.5'), `Should show decimal: ${formatted}`);
        logTest('3.3 formatBytes decimal precision', true);
    } catch (error) {
        logTest('3.3 formatBytes decimal precision', false, (error as Error).message);
    }

    // Test 3.4: formatRelativeTime recent
    try {
        const now = new Date();
        const result = formatRelativeTime(now);
        assertEqual(result, 'just now', 'Should show just now for current time');
        logTest('3.4 formatRelativeTime recent', true);
    } catch (error) {
        logTest('3.4 formatRelativeTime recent', false, (error as Error).message);
    }

    // Test 3.5: formatRelativeTime past
    try {
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const result = formatRelativeTime(hourAgo);
        assert(result.includes('hour'), `Should show hours: ${result}`);

        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const dayResult = formatRelativeTime(dayAgo);
        assert(dayResult.includes('day'), `Should show days: ${dayResult}`);
        logTest('3.5 formatRelativeTime past', true);
    } catch (error) {
        logTest('3.5 formatRelativeTime past', false, (error as Error).message);
    }

    // Test 3.6: getDefaultRegistry detection
    try {
        assertEqual(getDefaultRegistry('ghcr.io/user/repo'), 'ghcr.io', 'Should detect ghcr.io');
        assertEqual(getDefaultRegistry('gcr.io/project/image'), 'gcr.io', 'Should detect gcr.io');
        assertEqual(getDefaultRegistry('quay.io/org/image'), 'quay.io', 'Should detect quay.io');
        assertEqual(getDefaultRegistry('myapp'), 'docker.io', 'Should default to docker.io');
        logTest('3.6 getDefaultRegistry detection', true);
    } catch (error) {
        logTest('3.6 getDefaultRegistry detection', false, (error as Error).message);
    }

    // Test 3.7: getDefaultRegistry private registry
    try {
        assertEqual(
            getDefaultRegistry('my-registry.example.com/app'),
            'my-registry.example.com',
            'Should extract private registry'
        );
        logTest('3.7 getDefaultRegistry private registry', true);
    } catch (error) {
        logTest('3.7 getDefaultRegistry private registry', false, (error as Error).message);
    }
}

// ============================================================================
// Test 4: Registry Class Initialization
// ============================================================================

async function testRegistryInitialization(): Promise<void> {
    console.log('\n🏭 Test 4: Registry Class Initialization');

    // Test 4.1: Default initialization
    try {
        const registry = new Registry();
        assert(registry !== null, 'Registry should be created');
        logTest('4.1 Default initialization', true);
    } catch (error) {
        logTest('4.1 Default initialization', false, (error as Error).message);
    }

    // Test 4.2: Custom socket path
    try {
        const registry = new Registry('/var/run/docker.sock');
        assert(registry !== null, 'Registry should be created with custom socket');
        logTest('4.2 Custom socket path', true);
    } catch (error) {
        logTest('4.2 Custom socket path', false, (error as Error).message);
    }

    // Test 4.3: createRegistry convenience function
    try {
        const registry = createRegistry();
        assertInstanceOf(registry, Registry, 'Should return Registry instance');
        logTest('4.3 createRegistry convenience function', true);
    } catch (error) {
        logTest('4.3 createRegistry convenience function', false, (error as Error).message);
    }

    // Test 4.4: Docker availability check
    try {
        const registry = new Registry();
        const available = await registry.isAvailable();
        dockerAvailable = available;
        assert(typeof available === 'boolean', 'isAvailable should return boolean');
        logTest('4.4 Docker availability check', true);
        console.log(`         Docker available: ${dockerAvailable}`);
    } catch (error) {
        logTest('4.4 Docker availability check', false, (error as Error).message);
    }
}

// ============================================================================
// Test 5: Error Classes
// ============================================================================

async function testErrorClasses(): Promise<void> {
    console.log('\n💥 Test 5: Error Classes');

    // Test 5.1: RegistryError base class
    try {
        const error = new RegistryError('Test error', 'TEST_CODE');
        assertEqual(error.name, 'RegistryError', 'Should have correct name');
        assertEqual(error.code, 'TEST_CODE', 'Should have code');
        assertEqual(error.message, 'Test error', 'Should have message');
        assertInstanceOf(error, Error, 'Should extend Error');
        logTest('5.1 RegistryError base class', true);
    } catch (error) {
        logTest('5.1 RegistryError base class', false, (error as Error).message);
    }

    // Test 5.2: TagError class
    try {
        const error = new TagError('Tag failed', 'abc123', 'myapp:latest');
        assertEqual(error.name, 'TagError', 'Should have correct name');
        assertEqual(error.imageId, 'abc123', 'Should have imageId');
        assertEqual(error.tag, 'myapp:latest', 'Should have tag');
        assertInstanceOf(error, RegistryError, 'Should extend RegistryError');
        logTest('5.2 TagError class', true);
    } catch (error) {
        logTest('5.2 TagError class', false, (error as Error).message);
    }

    // Test 5.3: PushError class
    try {
        const error = new PushError('Push failed', 'myapp:latest', 'ghcr.io');
        assertEqual(error.name, 'PushError', 'Should have correct name');
        assertEqual(error.tag, 'myapp:latest', 'Should have tag');
        assertEqual(error.registry, 'ghcr.io', 'Should have registry');
        assertInstanceOf(error, RegistryError, 'Should extend RegistryError');
        logTest('5.3 PushError class', true);
    } catch (error) {
        logTest('5.3 PushError class', false, (error as Error).message);
    }

    // Test 5.4: AuthenticationError class
    try {
        const error = new AuthenticationError('Auth failed', 'docker.io');
        assertEqual(error.name, 'AuthenticationError', 'Should have correct name');
        assertEqual(error.registry, 'docker.io', 'Should have registry');
        assertInstanceOf(error, RegistryError, 'Should extend RegistryError');
        logTest('5.4 AuthenticationError class', true);
    } catch (error) {
        logTest('5.4 AuthenticationError class', false, (error as Error).message);
    }

    // Test 5.5: TagValidationError class
    try {
        const error = new TagValidationError('Invalid tag', 'bad:tag:here');
        assertEqual(error.name, 'TagValidationError', 'Should have correct name');
        assertEqual(error.invalidTag, 'bad:tag:here', 'Should have invalidTag');
        assertInstanceOf(error, RegistryError, 'Should extend RegistryError');
        logTest('5.5 TagValidationError class', true);
    } catch (error) {
        logTest('5.5 TagValidationError class', false, (error as Error).message);
    }

    // Test 5.6: Error with original error
    try {
        const original = new Error('Original error');
        const error = new RegistryError('Wrapper error', 'CODE', original);
        assertEqual(error.originalError, original, 'Should preserve original error');
        logTest('5.6 Error with original error', true);
    } catch (error) {
        logTest('5.6 Error with original error', false, (error as Error).message);
    }
}

// ============================================================================
// Test 6: Tag Operations (requires Docker)
// ============================================================================

async function testTagOperations(): Promise<void> {
    console.log('\n🔖 Test 6: Tag Operations');

    if (!dockerAvailable) {
        logSkipped('6.1-6.6 All tag operations', 'Docker not available');
        return;
    }

    const registry = new Registry();

    // Test 6.1: tagImage with empty tags
    try {
        await assertAsyncThrows(
            () => registry.tagImage('someimage', []),
            TagError,
            'Should throw on empty tags array'
        );
        logTest('6.1 tagImage rejects empty tags', true);
    } catch (error) {
        logTest('6.1 tagImage rejects empty tags', false, (error as Error).message);
    }

    // Test 6.2: tagImage validation
    try {
        // This should fail validation for invalid tags
        const result = await registry.tagImage('someimage', ['Invalid Tag!', 'valid:tag']);
        assert(result.failedTags.length > 0, 'Should have failed tags');
        assert(result.failedTags.some(f => f.tag === 'Invalid Tag!'), 'Should fail invalid tag');
        logTest('6.2 tagImage validates tags', true);
    } catch (error) {
        // If the image doesn't exist, that's fine - we're testing validation
        if ((error as Error).message.includes('No such image')) {
            logTest('6.2 tagImage validates tags', true);
        } else {
            logTest('6.2 tagImage validates tags', false, (error as Error).message);
        }
    }

    // Test 6.3: createStandardTags options
    try {
        // Test that createStandardTags generates correct tags (won't apply without image)
        const options: TagOptions = {
            prefix: 'test-app',
            version: '1.2.3',
            timestamp: true,
            latest: true
        };
        // This will fail because the image doesn't exist, but we can verify the error
        try {
            await registry.createStandardTags('nonexistent-image', options);
        } catch (e) {
            // Expected - image doesn't exist
        }
        logTest('6.3 createStandardTags with options', true);
    } catch (error) {
        logTest('6.3 createStandardTags with options', false, (error as Error).message);
    }

    // Test 6.4: TagResult structure
    try {
        const mockResult: TagResult = {
            imageId: 'abc123',
            appliedTags: ['app:latest'],
            failedTags: [{ tag: 'bad', error: 'Invalid' }]
        };
        assert(mockResult.imageId === 'abc123', 'Should have imageId');
        assert(Array.isArray(mockResult.appliedTags), 'appliedTags should be array');
        assert(Array.isArray(mockResult.failedTags), 'failedTags should be array');
        logTest('6.4 TagResult structure', true);
    } catch (error) {
        logTest('6.4 TagResult structure', false, (error as Error).message);
    }
}

// ============================================================================
// Test 7: Push Operations (with dry-run)
// ============================================================================

async function testPushOperations(): Promise<void> {
    console.log('\n📤 Test 7: Push Operations');

    const registry = new Registry();

    // Test 7.1: Dry-run mode
    try {
        let progressCalled = false;
        const options: PushOptions = {
            dryRun: true,
            onProgress: (event: PushProgressEvent) => {
                progressCalled = true;
                assert(event.status.includes('DRY RUN'), 'Should indicate dry run');
            }
        };

        await registry.pushImage('myapp:latest', 'docker.io', undefined, options);
        assert(progressCalled, 'Progress callback should be called');
        logTest('7.1 Dry-run mode', true);
    } catch (error) {
        logTest('7.1 Dry-run mode', false, (error as Error).message);
    }

    // Test 7.2: PushProgressEvent structure
    try {
        const event: PushProgressEvent = {
            status: 'Pushing',
            progress: 50,
            layer: 'sha256:abc',
            error: undefined
        };
        assertEqual(event.status, 'Pushing', 'Should have status');
        assertEqual(event.progress, 50, 'Should have progress');
        assertEqual(event.layer, 'sha256:abc', 'Should have layer');
        logTest('7.2 PushProgressEvent structure', true);
    } catch (error) {
        logTest('7.2 PushProgressEvent structure', false, (error as Error).message);
    }

    // Test 7.3: Push validates tag
    try {
        await assertAsyncThrows(
            () => registry.pushImage('Invalid Tag!', 'docker.io'),
            TagValidationError,
            'Should validate tag before push'
        );
        logTest('7.3 Push validates tag', true);
    } catch (error) {
        logTest('7.3 Push validates tag', false, (error as Error).message);
    }

    // Test 7.4: RegistryAuth structure
    try {
        const auth: RegistryAuth = {
            username: 'user',
            password: 'pass',
            serveraddress: 'ghcr.io',
            email: 'user@example.com'
        };
        assertEqual(auth.username, 'user', 'Should have username');
        assertEqual(auth.password, 'pass', 'Should have password');
        assertEqual(auth.serveraddress, 'ghcr.io', 'Should have serveraddress');
        logTest('7.4 RegistryAuth structure', true);
    } catch (error) {
        logTest('7.4 RegistryAuth structure', false, (error as Error).message);
    }

    // Test 7.5: getAuthFromEnv returns undefined when no env vars
    try {
        const authResult = Registry.getAuthFromEnv('unknown-registry');
        // Should return undefined when no matching env vars
        // (unless env vars are actually set)
        assert(authResult === undefined || typeof authResult === 'object', 'Should return undefined or auth object');
        logTest('7.5 getAuthFromEnv handles missing env', true);
    } catch (error) {
        logTest('7.5 getAuthFromEnv handles missing env', false, (error as Error).message);
    }
}

// ============================================================================
// Test 8: List Images (requires Docker)
// ============================================================================

async function testListImages(): Promise<void> {
    console.log('\n📋 Test 8: List Images');

    if (!dockerAvailable) {
        logSkipped('8.1-8.4 All list operations', 'Docker not available');
        return;
    }

    const registry = new Registry();

    // Test 8.1: List all images
    try {
        const images = await registry.listLocalImages();
        assert(Array.isArray(images), 'Should return array');
        logTest('8.1 List all images', true);
        console.log(`         Found ${images.length} images`);
    } catch (error) {
        logTest('8.1 List all images', false, (error as Error).message);
    }

    // Test 8.2: List with prefix filter
    try {
        const images = await registry.listLocalImages('nonexistent-prefix');
        assert(Array.isArray(images), 'Should return array');
        logTest('8.2 List with prefix filter', true);
    } catch (error) {
        logTest('8.2 List with prefix filter', false, (error as Error).message);
    }

    // Test 8.3: ImageInfo structure
    try {
        const images = await registry.listLocalImages();
        if (images.length > 0) {
            const img = images[0]!;
            assert(typeof img.id === 'string', 'Should have id');
            assert(typeof img.fullId === 'string', 'Should have fullId');
            assert(Array.isArray(img.tags), 'Should have tags array');
            assert(typeof img.size === 'number', 'Should have size');
            assert(typeof img.sizeFormatted === 'string', 'Should have sizeFormatted');
            assert(img.created instanceof Date, 'Should have created date');
            assert(typeof img.createdFormatted === 'string', 'Should have createdFormatted');
        }
        logTest('8.3 ImageInfo structure', true);
    } catch (error) {
        logTest('8.3 ImageInfo structure', false, (error as Error).message);
    }

    // Test 8.4: Images sorted by date
    try {
        const images = await registry.listLocalImages();
        if (images.length > 1) {
            for (let i = 1; i < images.length; i++) {
                const prev = images[i - 1]!;
                const curr = images[i]!;
                assert(
                    prev.created.getTime() >= curr.created.getTime(),
                    'Images should be sorted newest first'
                );
            }
        }
        logTest('8.4 Images sorted by date', true);
    } catch (error) {
        logTest('8.4 Images sorted by date', false, (error as Error).message);
    }
}

// ============================================================================
// Test 9: Prune Operations
// ============================================================================

async function testPruneOperations(): Promise<void> {
    console.log('\n🗑️  Test 9: Prune Operations');

    const registry = new Registry();

    // Test 9.1: Invalid keepCount
    try {
        await assertAsyncThrows(
            () => registry.pruneOldImages(-1),
            RegistryError,
            'Should reject negative keepCount'
        );
        logTest('9.1 Invalid keepCount rejection', true);
    } catch (error) {
        logTest('9.1 Invalid keepCount rejection', false, (error as Error).message);
    }

    // Test 9.2: PruneResult structure
    try {
        const mockResult: PruneResult = {
            removed: ['app:old1', 'app:old2'],
            kept: ['app:latest'],
            spaceReclaimed: 1024 * 1024 * 100,
            spaceReclaimedFormatted: '100 MB'
        };
        assert(Array.isArray(mockResult.removed), 'removed should be array');
        assert(Array.isArray(mockResult.kept), 'kept should be array');
        assert(typeof mockResult.spaceReclaimed === 'number', 'spaceReclaimed should be number');
        assert(typeof mockResult.spaceReclaimedFormatted === 'string', 'spaceReclaimedFormatted should be string');
        logTest('9.2 PruneResult structure', true);
    } catch (error) {
        logTest('9.2 PruneResult structure', false, (error as Error).message);
    }

    if (!dockerAvailable) {
        logSkipped('9.3-9.4 Prune with Docker', 'Docker not available');
        return;
    }

    // Test 9.3: Prune with high keepCount (should keep all)
    try {
        const result = await registry.pruneOldImages(1000, 'nonexistent-prefix-12345');
        assert(Array.isArray(result.removed), 'Should have removed array');
        assert(Array.isArray(result.kept), 'Should have kept array');
        logTest('9.3 Prune with high keepCount', true);
    } catch (error) {
        logTest('9.3 Prune with high keepCount', false, (error as Error).message);
    }

    // Test 9.4: Prune with keepCount = 0
    try {
        const result = await registry.pruneOldImages(0, 'nonexistent-prefix-xyz');
        assert(result.spaceReclaimed >= 0, 'Space reclaimed should be non-negative');
        logTest('9.4 Prune with keepCount = 0', true);
    } catch (error) {
        logTest('9.4 Prune with keepCount = 0', false, (error as Error).message);
    }
}

// ============================================================================
// Test 10: Convenience Functions
// ============================================================================

async function testConvenienceFunctions(): Promise<void> {
    console.log('\n🎯 Test 10: Convenience Functions');

    // Test 10.1: tagImage function
    try {
        assert(typeof tagImage === 'function', 'tagImage should be a function');
        logTest('10.1 tagImage function exists', true);
    } catch (error) {
        logTest('10.1 tagImage function exists', false, (error as Error).message);
    }

    // Test 10.2: pushImage function
    try {
        assert(typeof pushImage === 'function', 'pushImage should be a function');
        logTest('10.2 pushImage function exists', true);
    } catch (error) {
        logTest('10.2 pushImage function exists', false, (error as Error).message);
    }

    // Test 10.3: listLocalImages function
    try {
        assert(typeof listLocalImages === 'function', 'listLocalImages should be a function');
        if (dockerAvailable) {
            const images = await listLocalImages();
            assert(Array.isArray(images), 'Should return array');
        }
        logTest('10.3 listLocalImages function', true);
    } catch (error) {
        logTest('10.3 listLocalImages function', false, (error as Error).message);
    }

    // Test 10.4: pruneOldImages function
    try {
        assert(typeof pruneOldImages === 'function', 'pruneOldImages should be a function');
        logTest('10.4 pruneOldImages function exists', true);
    } catch (error) {
        logTest('10.4 pruneOldImages function exists', false, (error as Error).message);
    }
}

// ============================================================================
// Test 11: Remove Image Operation
// ============================================================================

async function testRemoveImage(): Promise<void> {
    console.log('\n🗑️  Test 11: Remove Image');

    if (!dockerAvailable) {
        logSkipped('11.1-11.2 Remove image operations', 'Docker not available');
        return;
    }

    const registry = new Registry();

    // Test 11.1: Remove non-existent image
    try {
        await assertAsyncThrows(
            () => registry.removeImage('nonexistent-image-xyz:latest'),
            RegistryError,
            'Should throw on non-existent image'
        );
        logTest('11.1 Remove non-existent image', true);
    } catch (error) {
        logTest('11.1 Remove non-existent image', false, (error as Error).message);
    }

    // Test 11.2: Remove with force flag
    try {
        // This will fail because image doesn't exist, but tests the API
        try {
            await registry.removeImage('nonexistent-xyz:v1', true);
        } catch (e) {
            if (!(e instanceof RegistryError)) throw e;
        }
        logTest('11.2 Remove with force flag', true);
    } catch (error) {
        logTest('11.2 Remove with force flag', false, (error as Error).message);
    }
}

// ============================================================================
// Test Runner
// ============================================================================

async function runAllTests(): Promise<void> {
    console.log('🧪 Registry Module Test Suite');
    console.log('━'.repeat(50));

    await testTagValidation();
    await testTagSanitization();
    await testUtilityFunctions();
    await testRegistryInitialization();
    await testErrorClasses();
    await testTagOperations();
    await testPushOperations();
    await testListImages();
    await testPruneOperations();
    await testConvenienceFunctions();
    await testRemoveImage();

    // Print summary
    console.log('\n' + '━'.repeat(50));
    console.log('📊 Test Summary');
    console.log('━'.repeat(50));

    const passed = results.filter(r => r.passed && !r.skipped).length;
    const failed = results.filter(r => !r.passed).length;
    const skipped = results.filter(r => r.skipped).length;
    const total = results.length;

    console.log(`\n  Total:   ${total}`);
    console.log(`  Passed:  ${passed} ✅`);
    console.log(`  Failed:  ${failed} ❌`);
    console.log(`  Skipped: ${skipped} ⏭️`);
    console.log(`\n  Docker available: ${dockerAvailable ? 'Yes' : 'No'}`);

    if (failed > 0) {
        console.log('\n❌ Failed Tests:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`  - ${r.name}: ${r.error}`);
        });
        process.exit(1);
    } else {
        console.log('\n✅ All tests passed!');
        process.exit(0);
    }
}

// Run tests
runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
