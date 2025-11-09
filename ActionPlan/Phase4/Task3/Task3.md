# Task 4.3: Create Image Builder

**Goal**: Execute Docker image builds with the generated Dockerfile and build context.

**Actions**:

- Extend `dockerizer.ts` with `async function buildMCPImage(manifest: MCPManifest, config: string, options: BuildOptions): Promise<string>`
- Create build context directory: temp folder with Dockerfile, all tools/connectors, config file, manifest.json
- Use `tar` library to create build context tarball (Docker API requires tar stream)
- Call DockerClient.buildImage() with context stream and generated Dockerfile
- Stream build progress to console: parse JSON progress messages, show step numbers, time elapsed
- Capture build logs: store in .build.log for debugging, include timestamps
- Handle build failures: parse error messages, identify which step failed, suggest fixes (missing dependency, syntax error)
- Add rollback capability: if build fails, don't tag image, clean up partial images
- Return imageId on success

**Success Criteria**: Successfully builds images; shows real-time progress; captures logs; handles failures gracefully
