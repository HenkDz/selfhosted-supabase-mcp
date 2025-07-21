/**
 * Role-Based Access Control (RBAC) system
 */

import type { Role, Permission, AuthContext } from './types.js';
import { AuthorizationError } from './types.js';

/**
 * RBAC Manager handles roles and permissions
 */
export class RBACManager {
    private roles = new Map<string, Role>();
    private systemRoles: string[] = [];

    constructor() {
        this.initializeSystemRoles();
    }

    /**
     * Initialize default system roles
     */
    private initializeSystemRoles(): void {
        // Anonymous role - minimal permissions
        const anonRole: Role = {
            name: 'anon',
            description: 'Anonymous user with minimal permissions',
            isSystemRole: true,
            permissions: [
                { action: 'read', resource: 'public_data' },
            ],
        };

        // Authenticated role - basic permissions
        const authenticatedRole: Role = {
            name: 'authenticated',
            description: 'Authenticated user with basic permissions',
            isSystemRole: true,
            permissions: [
                { action: 'read', resource: 'public_data' },
                { action: 'read', resource: 'user_data', conditions: { ownedByUser: true } },
                { action: 'read', resource: 'database_stats' },
                { action: 'read', resource: 'project_url' },
            ],
        };

        // Service role - elevated permissions for service operations
        const serviceRole: Role = {
            name: 'service_role',
            description: 'Service role with elevated permissions',
            isSystemRole: true,
            permissions: [
                { action: 'read', resource: '*' },
                { action: 'write', resource: 'auth_users' },
                { action: 'execute', resource: 'sql' },
                { action: 'read', resource: 'migrations' },
                { action: 'write', resource: 'migrations' },
                { action: 'read', resource: 'database_connections' },
                { action: 'read', resource: 'database_stats' },
                { action: 'execute', resource: 'rebuild_hooks' },
                { action: 'read', resource: 'storage_buckets' },
                { action: 'read', resource: 'storage_objects' },
                { action: 'read', resource: 'realtime_publications' },
            ],
        };

        // Admin role - full permissions
        const adminRole: Role = {
            name: 'admin',
            description: 'Administrator with full permissions',
            isSystemRole: true,
            permissions: [
                { action: '*', resource: '*' },
            ],
        };

        // Operator role - operational permissions without sensitive data access
        const operatorRole: Role = {
            name: 'operator',
            description: 'Operator with database and migration permissions',
            isSystemRole: true,
            permissions: [
                { action: 'read', resource: 'database_stats' },
                { action: 'read', resource: 'database_connections' },
                { action: 'read', resource: 'migrations' },
                { action: 'write', resource: 'migrations' },
                { action: 'execute', resource: 'sql', conditions: { readOnly: true } },
                { action: 'read', resource: 'extensions' },
                { action: 'read', resource: 'tables' },
                { action: 'execute', resource: 'generate_types' },
            ],
        };

        this.addRole(anonRole);
        this.addRole(authenticatedRole);
        this.addRole(serviceRole);
        this.addRole(adminRole);
        this.addRole(operatorRole);

        this.systemRoles = ['anon', 'authenticated', 'service_role', 'admin', 'operator'];
    }

    /**
     * Adds a new role
     */
    addRole(role: Role): void {
        this.roles.set(role.name, role);
    }

    /**
     * Gets a role by name
     */
    getRole(roleName: string): Role | undefined {
        return this.roles.get(roleName);
    }

    /**
     * Gets all roles
     */
    getAllRoles(): Role[] {
        return Array.from(this.roles.values());
    }

    /**
     * Checks if a user has permission to perform an action on a resource
     */
    hasPermission(
        authContext: AuthContext,
        action: string,
        resource: string,
        conditions?: Record<string, unknown>
    ): boolean {
        if (!authContext.isAuthenticated && !authContext.roles.includes('anon')) {
            return false;
        }

        // Check permissions for each role the user has
        for (const roleName of authContext.roles) {
            const role = this.getRole(roleName);
            if (!role) continue;

            // Check if any permission in this role grants access
            for (const permission of role.permissions) {
                if (this.matchesPermission(permission, action, resource, conditions)) {
                    return true;
                }
            }
        }

        // Check explicit permissions from JWT token
        for (const permissionStr of authContext.permissions) {
            const permission = this.parsePermissionString(permissionStr);
            if (permission && this.matchesPermission(permission, action, resource, conditions)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Checks if a permission matches the requested action and resource
     */
    private matchesPermission(
        permission: Permission,
        action: string,
        resource: string,
        conditions?: Record<string, unknown>
    ): boolean {
        // Check action
        if (permission.action !== '*' && permission.action !== action) {
            return false;
        }

        // Check resource
        if (permission.resource !== '*' && permission.resource !== resource) {
            return false;
        }

        // Check conditions if specified
        if (permission.conditions && conditions) {
            for (const [key, value] of Object.entries(permission.conditions)) {
                if (conditions[key] !== value) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Parses a permission string (e.g., "read:auth_users", "write:*")
     */
    private parsePermissionString(permissionStr: string): Permission | null {
        const parts = permissionStr.split(':');
        if (parts.length !== 2) {
            return null;
        }

        return {
            action: parts[0],
            resource: parts[1],
        };
    }

    /**
     * Enforces permission check and throws error if access denied
     */
    enforcePermission(
        authContext: AuthContext,
        action: string,
        resource: string,
        conditions?: Record<string, unknown>
    ): void {
        if (!this.hasPermission(authContext, action, resource, conditions)) {
            throw new AuthorizationError(
                `Access denied: ${action} on ${resource}`,
                'AUTH_ACCESS_DENIED'
            );
        }
    }

    /**
     * Gets required permissions for a tool
     */
    getToolPermissions(toolName: string): { action: string; resource: string; conditions?: Record<string, unknown> } {
        // Map tool names to required permissions
        const toolPermissions: Record<string, { action: string; resource: string; conditions?: Record<string, unknown> }> = {
            // Database tools
            'list_tables': { action: 'read', resource: 'tables' },
            'list_extensions': { action: 'read', resource: 'extensions' },
            'list_migrations': { action: 'read', resource: 'migrations' },
            'apply_migration': { action: 'write', resource: 'migrations' },
            'execute_sql': { action: 'execute', resource: 'sql' },
            'get_database_connections': { action: 'read', resource: 'database_connections' },
            'get_database_stats': { action: 'read', resource: 'database_stats' },
            
            // Configuration tools (sensitive)
            'get_project_url': { action: 'read', resource: 'project_url' },
            'get_anon_key': { action: 'read', resource: 'credentials' },
            'get_service_key': { action: 'read', resource: 'credentials' },
            
            // Generation tools
            'generate_typescript_types': { action: 'execute', resource: 'generate_types' },
            'rebuild_hooks': { action: 'execute', resource: 'rebuild_hooks' },
            'verify_jwt_secret': { action: 'read', resource: 'credentials' },
            
            // Auth tools
            'list_auth_users': { action: 'read', resource: 'auth_users' },
            'get_auth_user': { action: 'read', resource: 'auth_users' },
            'delete_auth_user': { action: 'write', resource: 'auth_users' },
            'create_auth_user': { action: 'write', resource: 'auth_users' },
            'update_auth_user': { action: 'write', resource: 'auth_users' },
            
            // Storage tools
            'list_storage_buckets': { action: 'read', resource: 'storage_buckets' },
            'list_storage_objects': { action: 'read', resource: 'storage_objects' },
            
            // Realtime tools
            'list_realtime_publications': { action: 'read', resource: 'realtime_publications' },
        };

        return toolPermissions[toolName] || { action: 'execute', resource: toolName };
    }

    /**
     * Checks if a tool requires human approval
     */
    requiresHumanApproval(toolName: string, authContext: AuthContext): boolean {
        // Tools that require human approval for non-admin users
        const humanApprovalTools = [
            'delete_auth_user',
            'apply_migration',
            'execute_sql', // SQL execution should require approval for destructive operations
        ];

        // Admins bypass human approval requirements
        if (authContext.roles.includes('admin')) {
            return false;
        }

        return humanApprovalTools.includes(toolName);
    }

    /**
     * Gets the minimum role required for a tool
     */
    getMinimumRole(toolName: string): string {
        const sensitiveTools = {
            'get_service_key': 'service_role',
            'get_anon_key': 'authenticated',
            'execute_sql': 'operator',
            'apply_migration': 'operator',
            'delete_auth_user': 'service_role',
            'create_auth_user': 'service_role',
            'update_auth_user': 'service_role',
        };

        return sensitiveTools[toolName] || 'authenticated';
    }
}