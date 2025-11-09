# Task 4.1: Implement Docker Client Wrapper

**Goal**: Create abstraction layer for Docker operations using dockerode.

**Actions**:

- Create `base/docker-client.ts` with class DockerClient
- Initialize dockerode: `new Docker({ socketPath: '/var/run/docker.sock' })` or from DOCKER_HOST env
- Implement `async ping(): Promise<boolean>` to verify Docker daemon connectivity
- Add `async buildImage(context: string, dockerfile: string, tag: string, onProgress?: (msg) => void): Promise<string>`
- Implement `async listImages(filter?: string): Promise<ImageInfo[]>` to query local images
- Add `async removeImage(imageId: string): Promise<void>` for cleanup
- Implement `async createContainer(config: ContainerConfig): Promise<Container>` and `startContainer(id: string)`
- Add error handling: wrap Docker errors with descriptive messages, detect "daemon not running" errors
- Implement streaming: use dockerode streams API for build progress, parse JSON progress messages

**Success Criteria**: Connects to Docker; builds images successfully; streams progress; handles errors gracefully
