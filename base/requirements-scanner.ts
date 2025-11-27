/**
 * Requirements Scanner
 * 
 * Scans Python files for imports and generates requirements.txt.
 * Supports detecting both standard library and third-party packages.
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Standard Library Detection
// ============================================================================

/**
 * Python standard library modules (Python 3.8+)
 * This list covers the most common stdlib modules
 */
const STDLIB_MODULES = new Set([
    // Core
    'abc', 'aifc', 'argparse', 'array', 'ast', 'asynchat', 'asyncio', 'asyncore',
    'atexit', 'audioop', 'base64', 'bdb', 'binascii', 'binhex', 'bisect',
    'builtins', 'bz2', 'calendar', 'cgi', 'cgitb', 'chunk', 'cmath', 'cmd',
    'code', 'codecs', 'codeop', 'collections', 'colorsys', 'compileall',
    'concurrent', 'configparser', 'contextlib', 'contextvars', 'copy', 'copyreg',
    'cProfile', 'crypt', 'csv', 'ctypes', 'curses', 'dataclasses', 'datetime',
    'dbm', 'decimal', 'difflib', 'dis', 'distutils', 'doctest', 'email',
    'encodings', 'enum', 'errno', 'faulthandler', 'fcntl', 'filecmp', 'fileinput',
    'fnmatch', 'formatter', 'fractions', 'ftplib', 'functools', 'gc', 'getopt',
    'getpass', 'gettext', 'glob', 'graphlib', 'grp', 'gzip', 'hashlib', 'heapq',
    'hmac', 'html', 'http', 'idlelib', 'imaplib', 'imghdr', 'imp', 'importlib',
    'inspect', 'io', 'ipaddress', 'itertools', 'json', 'keyword', 'lib2to3',
    'linecache', 'locale', 'logging', 'lzma', 'mailbox', 'mailcap', 'marshal',
    'math', 'mimetypes', 'mmap', 'modulefinder', 'multiprocessing', 'netrc',
    'nis', 'nntplib', 'numbers', 'operator', 'optparse', 'os', 'ossaudiodev',
    'parser', 'pathlib', 'pdb', 'pickle', 'pickletools', 'pipes', 'pkgutil',
    'platform', 'plistlib', 'poplib', 'posix', 'posixpath', 'pprint', 'profile',
    'pstats', 'pty', 'pwd', 'py_compile', 'pyclbr', 'pydoc', 'queue', 'quopri',
    'random', 're', 'readline', 'reprlib', 'resource', 'rlcompleter', 'runpy',
    'sched', 'secrets', 'select', 'selectors', 'shelve', 'shlex', 'shutil',
    'signal', 'site', 'smtpd', 'smtplib', 'sndhdr', 'socket', 'socketserver',
    'spwd', 'sqlite3', 'ssl', 'stat', 'statistics', 'string', 'stringprep',
    'struct', 'subprocess', 'sunau', 'symbol', 'symtable', 'sys', 'sysconfig',
    'syslog', 'tabnanny', 'tarfile', 'telnetlib', 'tempfile', 'termios', 'test',
    'textwrap', 'threading', 'time', 'timeit', 'tkinter', 'token', 'tokenize',
    'trace', 'traceback', 'tracemalloc', 'tty', 'turtle', 'turtledemo', 'types',
    'typing', 'unicodedata', 'unittest', 'urllib', 'uu', 'uuid', 'venv',
    'warnings', 'wave', 'weakref', 'webbrowser', 'winreg', 'winsound', 'wsgiref',
    'xdrlib', 'xml', 'xmlrpc', 'zipapp', 'zipfile', 'zipimport', 'zlib',
    // Added in Python 3.9+
    'zoneinfo', 'graphlib',
    // Added in Python 3.11+
    'tomllib',
]);

/**
 * Common package name mappings (import name -> package name)
 */
const PACKAGE_MAPPINGS: Record<string, string> = {
    'cv2': 'opencv-python',
    'PIL': 'Pillow',
    'sklearn': 'scikit-learn',
    'yaml': 'PyYAML',
    'bs4': 'beautifulsoup4',
    'dateutil': 'python-dateutil',
    'dotenv': 'python-dotenv',
    'jwt': 'PyJWT',
    'google': 'google-api-python-client',
    'googleapiclient': 'google-api-python-client',
    'httpx': 'httpx',
    'aiohttp': 'aiohttp',
    'fastapi': 'fastapi',
    'flask': 'flask',
    'django': 'django',
    'requests': 'requests',
    'numpy': 'numpy',
    'pandas': 'pandas',
    'scipy': 'scipy',
    'matplotlib': 'matplotlib',
    'seaborn': 'seaborn',
    'plotly': 'plotly',
    'boto3': 'boto3',
    'botocore': 'botocore',
    'redis': 'redis',
    'pymongo': 'pymongo',
    'sqlalchemy': 'sqlalchemy',
    'psycopg2': 'psycopg2-binary',
    'mysql': 'mysql-connector-python',
    'celery': 'celery',
    'pydantic': 'pydantic',
    'pytest': 'pytest',
    'attr': 'attrs',
    'attrs': 'attrs',
    'lxml': 'lxml',
    'cryptography': 'cryptography',
    'paramiko': 'paramiko',
    'fabric': 'fabric',
    'jinja2': 'Jinja2',
    'Jinja2': 'Jinja2',
    'werkzeug': 'Werkzeug',
    'click': 'click',
    'rich': 'rich',
    'typer': 'typer',
    'anthropic': 'anthropic',
    'openai': 'openai',
    'transformers': 'transformers',
    'torch': 'torch',
    'tensorflow': 'tensorflow',
    'keras': 'keras',
};

// ============================================================================
// Import Extraction
// ============================================================================

interface ImportInfo {
    module: string;
    submodule?: string;
    alias?: string;
    isFrom: boolean;
    line: number;
}

/**
 * Extract imports from Python source code
 */
function extractImports(source: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const lines = source.split('\n');

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i]?.trim() ?? '';
        const lineNum = i + 1;

        // Skip comments and empty lines
        if (line.startsWith('#') || line === '') continue;

        // Strip inline comments
        const commentIndex = line.indexOf('#');
        if (commentIndex > 0) {
            line = line.substring(0, commentIndex).trim();
        }

        // Match 'import x' or 'import x as y' or 'import x, y, z'
        const importMatch = line.match(/^import\s+(.+)$/);
        if (importMatch && importMatch[1]) {
            const modules = importMatch[1].split(',').map(m => m.trim());
            for (const mod of modules) {
                const aliasMatch = mod.match(/^(\S+)\s+as\s+(\S+)$/);
                if (aliasMatch && aliasMatch[1]) {
                    const moduleName = aliasMatch[1].split('.')[0] ?? aliasMatch[1];
                    imports.push({
                        module: moduleName,
                        alias: aliasMatch[2],
                        isFrom: false,
                        line: lineNum,
                    });
                } else {
                    const moduleName = mod.split('.')[0] ?? mod;
                    imports.push({
                        module: moduleName,
                        isFrom: false,
                        line: lineNum,
                    });
                }
            }
            continue;
        }

        // Match 'from x import y' or 'from x.y import z'
        const fromMatch = line.match(/^from\s+(\S+)\s+import\s+(.+)$/);
        if (fromMatch && fromMatch[1]) {
            const fullModule = fromMatch[1];
            const module = fullModule.split('.')[0] ?? fullModule;
            const submodule = fullModule.includes('.') ? fullModule : undefined;

            imports.push({
                module,
                submodule,
                isFrom: true,
                line: lineNum,
            });
        }
    }

    return imports;
}

/**
 * Determine if a module is from the standard library
 */
function isStdlib(module: string): boolean {
    return STDLIB_MODULES.has(module);
}

/**
 * Get the package name for a module
 */
export function getPackageName(module: string): string {
    return PACKAGE_MAPPINGS[module] || module;
}

// ============================================================================
// Requirements Scanner
// ============================================================================

export interface ScanResult {
    imports: ImportInfo[];
    requirements: string[];
    stdlibImports: string[];
    unknownImports: string[];
}

export interface ScanOptions {
    /**
     * Whether to include version constraints
     */
    includeVersions?: boolean;

    /**
     * Additional package mappings
     */
    packageMappings?: Record<string, string>;

    /**
     * Version constraints for known packages
     */
    versionConstraints?: Record<string, string>;

    /**
     * Whether to include dev dependencies
     */
    includeDev?: boolean;
}

/**
 * Scan a Python file for imports
 */
export function scanFile(filePath: string, options: ScanOptions = {}): ScanResult {
    const source = fs.readFileSync(filePath, 'utf-8');
    return scanSource(source, options);
}

/**
 * Scan Python source code for imports
 */
export function scanSource(source: string, options: ScanOptions = {}): ScanResult {
    const imports = extractImports(source);
    const customMappings = { ...PACKAGE_MAPPINGS, ...options.packageMappings };

    const stdlibImports: string[] = [];
    const thirdPartyImports: string[] = [];
    const unknownImports: string[] = [];

    const seen = new Set<string>();

    for (const imp of imports) {
        if (seen.has(imp.module)) continue;
        seen.add(imp.module);

        if (isStdlib(imp.module)) {
            stdlibImports.push(imp.module);
        } else if (customMappings[imp.module] || imp.module === customMappings[imp.module]) {
            thirdPartyImports.push(imp.module);
        } else {
            // Check if it looks like a local module (starts with . or is lowercase without hyphens)
            if (imp.module.startsWith('.')) {
                continue; // Relative import, skip
            }
            // Assume it's a third-party package
            thirdPartyImports.push(imp.module);
            unknownImports.push(imp.module);
        }
    }

    // Generate requirements
    const requirements = thirdPartyImports.map(mod => {
        const packageName = customMappings[mod] || mod;
        const version = options.versionConstraints?.[packageName];

        if (version && options.includeVersions) {
            return `${packageName}${version}`;
        }
        return packageName;
    });

    return {
        imports,
        requirements: [...new Set(requirements)].sort(),
        stdlibImports: [...new Set(stdlibImports)].sort(),
        unknownImports: [...new Set(unknownImports)].sort(),
    };
}

/**
 * Scan a directory for Python files and aggregate requirements
 */
export function scanDirectory(
    dirPath: string,
    options: ScanOptions = {}
): ScanResult {
    const allImports: ImportInfo[] = [];
    const allRequirements = new Set<string>();
    const allStdlib = new Set<string>();
    const allUnknown = new Set<string>();

    function scan(dir: string): void {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                // Skip common non-source directories
                if (['__pycache__', 'node_modules', '.git', 'venv', 'env', '.venv'].includes(entry.name)) {
                    continue;
                }
                scan(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.py')) {
                try {
                    const result = scanFile(fullPath, options);
                    allImports.push(...result.imports);
                    result.requirements.forEach(r => allRequirements.add(r));
                    result.stdlibImports.forEach(s => allStdlib.add(s));
                    result.unknownImports.forEach(u => allUnknown.add(u));
                } catch (e) {
                    console.warn(`Failed to scan ${fullPath}: ${e}`);
                }
            }
        }
    }

    scan(dirPath);

    return {
        imports: allImports,
        requirements: [...allRequirements].sort(),
        stdlibImports: [...allStdlib].sort(),
        unknownImports: [...allUnknown].sort(),
    };
}

/**
 * Generate requirements.txt content
 */
export function generateRequirementsTxt(
    result: ScanResult,
    options: {
        header?: string;
        includeComments?: boolean;
    } = {}
): string {
    const lines: string[] = [];

    if (options.header) {
        lines.push(`# ${options.header}`);
    } else {
        lines.push('# Auto-generated requirements.txt');
        lines.push(`# Generated at: ${new Date().toISOString()}`);
    }
    lines.push('');

    if (options.includeComments && result.unknownImports.length > 0) {
        lines.push('# Note: The following packages may need version verification:');
        result.unknownImports.forEach(pkg => {
            lines.push(`#   - ${pkg}`);
        });
        lines.push('');
    }

    lines.push(...result.requirements);

    return lines.join('\n') + '\n';
}

/**
 * Detect Python version from pyproject.toml or setup.py
 */
export function detectPythonVersion(projectDir: string): string | null {
    // Check pyproject.toml
    const pyprojectPath = path.join(projectDir, 'pyproject.toml');
    if (fs.existsSync(pyprojectPath)) {
        const content = fs.readFileSync(pyprojectPath, 'utf-8');
        const versionMatch = content.match(/python\s*[>=<]+\s*"?(3\.\d+)/);
        if (versionMatch && versionMatch[1]) {
            return versionMatch[1];
        }
    }

    // Check setup.py
    const setupPath = path.join(projectDir, 'setup.py');
    if (fs.existsSync(setupPath)) {
        const content = fs.readFileSync(setupPath, 'utf-8');
        const versionMatch = content.match(/python_requires\s*=\s*['"]>=?(3\.\d+)/);
        if (versionMatch && versionMatch[1]) {
            return versionMatch[1];
        }
    }

    // Default to 3.10
    return '3.10';
}

/**
 * Merge existing requirements with scanned ones
 */
export function mergeRequirements(
    existing: string,
    scanned: string[]
): string[] {
    const existingPkgs = new Map<string, string>();

    // Parse existing requirements
    for (const line of existing.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-')) {
            const match = trimmed.match(/^([a-zA-Z0-9_-]+)(.*)$/);
            if (match && match[1] && match[0]) {
                existingPkgs.set(match[1].toLowerCase(), match[0]);
            }
        }
    }

    // Merge with scanned
    for (const pkg of scanned) {
        const match = pkg.match(/^([a-zA-Z0-9_-]+)(.*)$/);
        if (match && match[1]) {
            const name = match[1].toLowerCase();
            if (!existingPkgs.has(name)) {
                existingPkgs.set(name, pkg);
            }
        }
    }

    return [...existingPkgs.values()].sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase())
    );
}

// ============================================================================
// CLI Support
// ============================================================================

if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Usage: requirements-scanner <path> [--output <file>]');
        process.exit(1);
    }

    const targetPath = args[0];
    if (!targetPath) {
        console.log('Usage: requirements-scanner <path> [--output <file>]');
        process.exit(1);
    }

    const outputIndex = args.indexOf('--output');
    const outputFile = outputIndex !== -1 ? args[outputIndex + 1] : null;

    const isDir = fs.statSync(targetPath).isDirectory();
    const result = isDir
        ? scanDirectory(targetPath, { includeVersions: false })
        : scanFile(targetPath, { includeVersions: false });

    const content = generateRequirementsTxt(result, { includeComments: true });

    if (outputFile) {
        fs.writeFileSync(outputFile, content);
        console.log(`Written to ${outputFile}`);
    } else {
        console.log(content);
    }

    if (result.unknownImports.length > 0) {
        console.warn('\nWarning: Some imports could not be verified:');
        result.unknownImports.forEach(pkg => console.warn(`  - ${pkg}`));
    }
}
