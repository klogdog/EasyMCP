# Task 4.4: Implement Image Tagging & Registry

**Goal**: Tag built images with meaningful names and optionally push to registry.

**Actions**:

- Create `base/registry.ts` with `async function tagImage(imageId: string, tags: string[]): Promise<void>`
- Implement tagging strategy: use `mcp-server:latest`, `mcp-server:v{version}`, `mcp-server:{timestamp}`
- Add `async function pushImage(tag: string, registry: string, auth?: RegistryAuth): Promise<void>` using dockerode
- Implement registry authentication: support Docker Hub, GitHub Container Registry, private registries via auth config
- Create `async function listLocalImages(prefix: string): Promise<ImageInfo[]>` to show available MCP images
- Add cleanup utility: `async function pruneOldImages(keepCount: number): Promise<void>` to remove old builds
- Implement tag validation: ensure tags follow Docker naming conventions, handle special characters
- Add dry-run mode for push operations

**Success Criteria**: Tags images with version/timestamp; can push to registry; cleans up old images
