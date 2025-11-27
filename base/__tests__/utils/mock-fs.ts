/**
 * Mock File System Utilities
 * 
 * Provides mock implementations and utilities for testing file system operations.
 * Uses jest mocking to simulate fs operations without touching the real file system.
 * 
 * @module test-utils/mock-fs
 */

import { jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Represents a virtual file system structure
 */
export interface VirtualFileSystem {
    [path: string]: string | VirtualFileSystem;
}

/**
 * File metadata for mock stat operations
 */
export interface MockFileStat {
    isFile: boolean;
    isDirectory: boolean;
    size: number;
    mtime: Date;
    mode: number;
}

/**
 * Creates a mock file system from a virtual structure
 * 
 * @example
 * ```typescript
 * const vfs = createMockFileSystem({
 *   '/app': {
 *     'src': {
 *       'index.ts': 'export const main = () => {};',
 *       'utils.ts': 'export function helper() {}'
 *     },
 *     'package.json': '{"name": "test-app"}'
 *   }
 * });
 * ```
 */
export function createMockFileSystem(structure: VirtualFileSystem): MockFileSystemInstance {
    const files = new Map<string, string>();
    const directories = new Set<string>();

    // Normalize a path to ensure consistent format
    function normalizePath(p: string): string {
        // Remove trailing slashes and normalize
        let normalized = path.normalize(p);
        // Ensure paths start with /
        if (!normalized.startsWith('/')) {
            normalized = '/' + normalized;
        }
        // Remove trailing slash unless it's the root
        if (normalized !== '/' && normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }
        return normalized;
    }

    // Flatten the structure into paths
    function processStructure(obj: VirtualFileSystem, currentPath: string = '') {
        const normalizedCurrent = currentPath ? normalizePath(currentPath) : '/';
        directories.add(normalizedCurrent);

        for (const [name, content] of Object.entries(obj)) {
            // Handle keys that already have leading slashes
            const cleanName = name.startsWith('/') ? name : `/${name}`;
            const fullPath = normalizedCurrent === '/'
                ? cleanName
                : normalizePath(`${normalizedCurrent}${cleanName}`);

            if (typeof content === 'string') {
                files.set(fullPath, content);
            } else {
                directories.add(fullPath);
                processStructure(content, fullPath);
            }
        }
    }

    processStructure(structure);

    return {
        files,
        directories,

        exists(filePath: string): boolean {
            const normalized = normalizePath(filePath);
            return files.has(normalized) || directories.has(normalized);
        },

        isFile(filePath: string): boolean {
            return files.has(normalizePath(filePath));
        },

        isDirectory(filePath: string): boolean {
            return directories.has(normalizePath(filePath));
        },

        readFile(filePath: string): string {
            const normalized = normalizePath(filePath);
            const content = files.get(normalized);
            if (content === undefined) {
                throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
            }
            return content;
        },

        readdir(dirPath: string): string[] {
            const normalized = normalizePath(dirPath);
            if (!directories.has(normalized)) {
                throw new Error(`ENOENT: no such file or directory, scandir '${dirPath}'`);
            }

            const entries: string[] = [];
            const prefix = normalized === '/' ? '/' : normalized + '/';

            // Find immediate children
            for (const filePath of files.keys()) {
                if (filePath.startsWith(prefix)) {
                    const relativePath = filePath.slice(prefix.length);
                    const firstSegment = relativePath.split('/')[0];
                    if (firstSegment && !entries.includes(firstSegment)) {
                        entries.push(firstSegment);
                    }
                }
            }

            for (const dp of directories) {
                if (dp.startsWith(prefix) && dp !== normalized) {
                    const relativePath = dp.slice(prefix.length);
                    const firstSegment = relativePath.split('/')[0];
                    if (firstSegment && !entries.includes(firstSegment)) {
                        entries.push(firstSegment);
                    }
                }
            }

            return entries.sort();
        },

        stat(filePath: string): MockFileStat {
            const normalized = normalizePath(filePath);

            if (files.has(normalized)) {
                const content = files.get(normalized)!;
                return {
                    isFile: true,
                    isDirectory: false,
                    size: content.length,
                    mtime: new Date(),
                    mode: 0o644
                };
            }

            if (directories.has(normalized)) {
                return {
                    isFile: false,
                    isDirectory: true,
                    size: 4096,
                    mtime: new Date(),
                    mode: 0o755
                };
            }

            throw new Error(`ENOENT: no such file or directory, stat '${filePath}'`);
        },

        writeFile(filePath: string, content: string): void {
            const normalized = normalizePath(filePath);
            files.set(normalized, content);

            // Ensure parent directories exist
            let dir = path.dirname(normalized);
            while (dir !== '/') {
                directories.add(normalizePath(dir));
                dir = path.dirname(dir);
            }
        },

        mkdir(dirPath: string): void {
            const normalized = normalizePath(dirPath);
            directories.add(normalized);

            // Ensure parent directories exist
            let dir = path.dirname(normalized);
            while (dir !== '/') {
                directories.add(normalizePath(dir));
                dir = path.dirname(dir);
            }
        },

        rm(filePath: string): void {
            const normalized = normalizePath(filePath);
            files.delete(normalized);
            directories.delete(normalized);
        },

        reset(): void {
            files.clear();
            directories.clear();
        }
    };
}

/**
 * Mock file system instance interface
 */
export interface MockFileSystemInstance {
    files: Map<string, string>;
    directories: Set<string>;
    exists(filePath: string): boolean;
    isFile(filePath: string): boolean;
    isDirectory(filePath: string): boolean;
    readFile(filePath: string): string;
    readdir(dirPath: string): string[];
    stat(filePath: string): MockFileStat;
    writeFile(filePath: string, content: string): void;
    mkdir(dirPath: string): void;
    rm(filePath: string): void;
    reset(): void;
}

/**
 * Sets up jest mocks for fs module using the provided virtual file system
 * 
 * @example
 * ```typescript
 * const mockFs = createMockFileSystem({ ... });
 * setupFsMocks(mockFs);
 * 
 * // Now fs operations will use the mock
 * const content = fs.readFileSync('/app/src/index.ts', 'utf-8');
 * ```
 */
export function setupFsMocks(mockFs: MockFileSystemInstance): void {
    // Mock fs.existsSync
    jest.spyOn(fs, 'existsSync').mockImplementation((filePath: fs.PathLike) => {
        return mockFs.exists(filePath.toString());
    });

    // Mock fs.readFileSync
    jest.spyOn(fs, 'readFileSync').mockImplementation((filePath: fs.PathOrFileDescriptor, options?: any) => {
        const content = mockFs.readFile(filePath.toString());
        if (options === 'utf-8' || options === 'utf8' || options?.encoding === 'utf-8' || options?.encoding === 'utf8') {
            return content;
        }
        return Buffer.from(content);
    });

    // Mock fs.readdirSync
    jest.spyOn(fs, 'readdirSync').mockImplementation((dirPath: fs.PathLike, _options?: any) => {
        return mockFs.readdir(dirPath.toString()) as any;
    });

    // Mock fs.statSync
    jest.spyOn(fs, 'statSync').mockImplementation((filePath: fs.PathLike) => {
        const stat = mockFs.stat(filePath.toString());
        return {
            isFile: () => stat.isFile,
            isDirectory: () => stat.isDirectory,
            size: stat.size,
            mtime: stat.mtime,
            mode: stat.mode
        } as fs.Stats;
    });

    // Mock fs.lstatSync (similar to statSync for our purposes)
    jest.spyOn(fs, 'lstatSync').mockImplementation((filePath: fs.PathLike) => {
        const stat = mockFs.stat(filePath.toString());
        return {
            isFile: () => stat.isFile,
            isDirectory: () => stat.isDirectory,
            isSymbolicLink: () => false,
            size: stat.size,
            mtime: stat.mtime,
            mode: stat.mode
        } as fs.Stats;
    });

    // Mock fs.writeFileSync
    jest.spyOn(fs, 'writeFileSync').mockImplementation((filePath: fs.PathOrFileDescriptor, data: any) => {
        mockFs.writeFile(filePath.toString(), data.toString());
    });

    // Mock fs.mkdirSync
    jest.spyOn(fs, 'mkdirSync').mockImplementation((dirPath: fs.PathLike, _options?: any) => {
        mockFs.mkdir(dirPath.toString());
        return undefined;
    });

    // Mock fs.rmSync
    jest.spyOn(fs, 'rmSync').mockImplementation((filePath: fs.PathLike, _options?: any) => {
        mockFs.rm(filePath.toString());
    });
}

/**
 * Clears all fs mocks
 */
export function clearFsMocks(): void {
    jest.restoreAllMocks();
}

/**
 * Creates a mock for fs.promises (async file operations)
 */
export function createMockFsPromises(mockFs: MockFileSystemInstance) {
    return {
        readFile: jest.fn(async (filePath: string, _encoding?: string) => {
            return mockFs.readFile(filePath);
        }),

        writeFile: jest.fn(async (filePath: string, data: string) => {
            mockFs.writeFile(filePath, data);
        }),

        readdir: jest.fn(async (dirPath: string) => {
            return mockFs.readdir(dirPath);
        }),

        stat: jest.fn(async (filePath: string) => {
            const stat = mockFs.stat(filePath);
            return {
                isFile: () => stat.isFile,
                isDirectory: () => stat.isDirectory,
                size: stat.size,
                mtime: stat.mtime
            };
        }),

        mkdir: jest.fn(async (dirPath: string, _options?: any) => {
            mockFs.mkdir(dirPath);
        }),

        rm: jest.fn(async (filePath: string, _options?: any) => {
            mockFs.rm(filePath);
        }),

        access: jest.fn(async (filePath: string) => {
            if (!mockFs.exists(filePath)) {
                throw new Error(`ENOENT: no such file or directory, access '${filePath}'`);
            }
        })
    };
}

export default createMockFileSystem;
