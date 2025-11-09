# Task 12.4: Implement RBAC for Tools

**Goal**: Add role-based access control to restrict tool access by user/role.

**Actions**:

- Create `base/rbac.ts` with RBAC system: define Roles, Permissions, Users
- Define permission model: each tool has required permissions (e.g., `email:read`, `email:send`, `data:query`)
- Implement role definition: `interface Role { name: string, permissions: string[], inherits?: string[] }`
- Add permission checking: middleware `checkPermission(toolName, user)` that verifies user has required permissions
- Create authentication middleware: extract user/API key from request headers, validate, load user's roles
- Implement authorization checks: before tool invocation, verify `user.hasPermission(tool.requiredPermissions)`
- Add role configuration: define roles in config file `rbac: { roles: { admin: [...], viewer: [...] }, users: { ... } }`
- Create audit logging: log all authorization decisions (granted/denied), include user, tool, timestamp
- Add default roles: admin (all permissions), user (basic tools), readonly (query only)
- Implement token-based auth: JWT or API keys, include roles/permissions in token claims
- Document RBAC setup: how to define roles, assign to users, configure per-tool permissions

**Success Criteria**: RBAC system functional; roles and permissions configurable; authorization enforced; audit logging works; documented
