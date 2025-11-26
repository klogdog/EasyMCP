## Create a new git branch for the task from Phase4 and merge back into Phase4 when finished

# Work Notes - Task 4.4: Implement Image Tagging & Registry

## Current Status

**Task 4.3 (Create Image Builder)** has been **COMPLETED** ✅

### What Was Done in Task 4.3

The previous agent successfully completed all requirements for the image builder.

**Key accomplishments:**

- ✅ Extended `base/dockerizer.ts` with `buildMCPImage()` function (~500 lines)
- ✅ Creates temporary build context directory with all required files
- ✅ Generates Dockerfile based on manifest configuration
- ✅ Calls DockerClient.buildImage() with progress streaming
- ✅ Parses JSON progress messages with step numbers and timing
- ✅ Captures build logs with timestamps to .build.log
- ✅ Handles build failures with diagnostic info and fix suggestions
- ✅ Cleanup on failure with configurable `cleanupOnFailure` option
- ✅ Returns imageId on success
- ✅ Added 26 new tests (Tests 11-17), all 116 tests passing
- ✅ Merged to Phase4

Full details in: `/workspace/ActionPlan/Phase4/Task3/TaskCompleteNote3.md`

---

## Your Task: Task 4.4 - Implement Image Tagging & Registry

**Phase**: Phase 4 - Docker Integration  
**Goal**: Tag built images with meaningful names and optionally push to registry.

### Key Requirements:

1. **Create `base/registry.ts`** with new function:

   ```typescript
   async function tagImage(imageId: string, tags: string[]): Promise<void>;
   ```

2. **Implement tagging strategy**:
   - `mcp-server:latest`
   - `mcp-server:v{version}` (e.g., v1.0.0)
   - `mcp-server:{timestamp}` (e.g., 20251126-143022)

3. **Add push functionality**:

   ```typescript
   async function pushImage(
     tag: string,
     registry: string,
     auth?: RegistryAuth
   ): Promise<void>;
   ```

4. **Registry authentication support**:
   - Docker Hub
   - GitHub Container Registry (ghcr.io)
   - Private registries
   - Auth via config

5. **List local images**:

   ```typescript
   async function listLocalImages(prefix: string): Promise<ImageInfo[]>;
   ```

6. **Cleanup utility**:

   ```typescript
   async function pruneOldImages(keepCount: number): Promise<void>;
   ```

7. **Tag validation**:
   - Follow Docker naming conventions
   - Handle special characters
   - Validate before applying

8. **Add dry-run mode**:
   - Preview push operations without executing

9. **Create tests** in `base/test-registry.ts`

### Quick Start:

```bash
git checkout Phase4
git checkout -b task-4.4

# Create base/registry.ts with all functions
# Create base/test-registry.ts with tests
npm run build && node dist/test-registry.js

# Complete documentation and merge
git commit -am "Complete Task 4.4 - Image Tagging & Registry"
git checkout Phase4 && git merge --no-ff task-4.4
```

### Reference Files:

- Task details: `/workspace/ActionPlan/Phase4/Task4/Task4.md`
- Docker client: `/workspace/base/docker-client.ts`
- Image builder: `/workspace/base/dockerizer.ts`

### Dependencies:

- `dockerode` - already installed
- `DockerClient` class from `docker-client.ts`

### Interfaces to Implement:

```typescript
interface RegistryAuth {
  username: string;
  password: string;
  serveraddress?: string; // Registry URL
  email?: string; // For some registries
}

interface TagOptions {
  version?: string; // Use manifest version
  timestamp?: boolean; // Add timestamp tag
  latest?: boolean; // Add :latest tag
  prefix?: string; // Custom prefix
}

interface PushOptions {
  dryRun?: boolean; // Preview only
  onProgress?: (event: PushProgressEvent) => void;
}

interface PushProgressEvent {
  status: string;
  progress?: number;
  layer?: string;
  error?: string;
}
```

### Expected Output:

```
Tagging image sha256:abc123...
  → mcp-server:latest
  → mcp-server:v1.0.0
  → mcp-server:20251126-143022
✅ Tagged successfully

Pushing to ghcr.io/user/mcp-server:v1.0.0...
  Layer 1/5: [=========>        ] 45%
  Layer 2/5: [==================] 100%
  ...
✅ Push completed
```

- Checklist: `/workspace/ActionPlan/Phase4/TaskCheckList4.md`

---

## ⚠️ IMPORTANT: After Completing Task 4.4

You MUST complete these steps after finishing the implementation:

1. **Write TaskReview4.md** - Create a review document at `/workspace/ActionPlan/Phase4/Task4/TaskReview4.md`
   - Include code review (analyze implementation quality)
   - Include test review (verify all tests pass)
   - Include success criteria verification
   - Mark as APPROVED or note any issues found

2. **Update TaskCheckList4.md** - Check off completed items in `/workspace/ActionPlan/Phase4/TaskCheckList4.md`

3. **Write TaskCompleteNote4.md** - Document what was done at `/workspace/ActionPlan/Phase4/Task4/TaskCompleteNote4.md`

4. **Update this WorkNotes.md** - Rewrite with instructions for Phase 5 (or final Phase 4 review if this is the last task)

---

## Next Steps Preview

After completing Task 4.4, Phase 4 will be complete.

The next phase is **Phase 5: Server Runtime**.

See full details: `/workspace/ActionPlan/Phase5/`
