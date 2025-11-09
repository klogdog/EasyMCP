# Task 1.3: Set Up Development Container

**Goal**: Create VS Code devcontainer for Docker-in-Docker development environment.

**Actions**:

- Create `.devcontainer/devcontainer.json`
- Set `image: "mcr.microsoft.com/devcontainers/typescript-node:20"` or similar
- Add features: `"ghcr.io/devcontainers/features/docker-in-docker:2"` for DinD capability
- Configure mounts: bind `/tools`, `/connectors`, `/config` to container
- Set `remoteEnv` for forwarding HOST_PROJECT_PATH, DOCKER_HOST
- Add `postCreateCommand: "npm install"` for automatic setup
- Configure VS Code extensions: Docker, ESLint, Prettier

**Success Criteria**: Opening in VS Code starts container; `docker ps` works inside container; npm packages installed
