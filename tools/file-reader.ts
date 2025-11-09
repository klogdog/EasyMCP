/**
 * Sample MCP Tool - File Reader
 * 
 * This is a sample tool that demonstrates how to structure an MCP tool module.
 */

export const metadata = {
    "name": "file-reader",
    "description": "Reads and returns file contents from the filesystem",
    "version": "1.0.0",
    "capabilities": ["read", "stat", "list"]
};

/**
 * Read a file from the filesystem
 */
export async function readFile(path: string): Promise<string> {
    // Implementation would go here
    return `Contents of ${path}`;
}

/**
 * List files in a directory
 */
export async function listFiles(dirPath: string): Promise<string[]> {
    // Implementation would go here
    return ["file1.txt", "file2.txt"];
}
