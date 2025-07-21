/**
 * Authentication middleware for MCP server
 */

import type { AuthContext, AuthConfig, JWTPayload, SessionData } from './types.js';
import { AuthenticationError, AuthorizationError } from './types.js';
import { JWTValidator } from './jwt.js';
import { SessionManager } from './session.js';
import { RBACManager } from './rbac.js';
import { sanitizeCredentialForLogging } from './credentials.js';

/**
 * Authentication middleware that handles JWT validation, session management, and RBAC
 */
export class AuthenticationMiddleware {
    private jwtValidator: JWTValidator;
    private sessionManager: SessionManager;
    private rbacManager: RBACManager;
    private config: AuthConfig;

    constructor(config: AuthConfig) {
        this.config = config;
        this.jwtValidator = new JWTValidator(config);
        this.sessionManager = new SessionManager(config);
        this.rbacManager = new RBACManager();
    }

    /**
     * Creates authentication context from JWT token
     */
    async authenticateToken(
        token: string,
        userAgent?: string,
        ipAddress?: string
    ): Promise<AuthContext> {
        try {
            // Validate JWT token
            const payload = await this.jwtValidator.validateToken(token);
            
            // Extract roles and permissions
            const roles = this.jwtValidator.extractRoles(payload);
            const permissions = this.jwtValidator.extractPermissions(payload);

            // Create or validate session
            const sessionId = await this.createOrValidateSession(payload, userAgent, ipAddress);

            const authContext: AuthContext = {
                userId: payload.sub,
                sessionId,
                roles,
                permissions,
                isAuthenticated: true,
                tokenAudience: payload.aud,
                tokenIssuer: payload.iss,
                tokenSubject: payload.sub,
                tokenExpires: payload.exp ? new Date(payload.exp * 1000) : undefined,
            };

            console.error(`Authentication successful for user ${sanitizeCredentialForLogging(payload.sub)} with roles: ${roles.join(', ')}`);
            return authContext;

        } catch (error) {
            console.error('Authentication failed:', error instanceof Error ? error.message : String(error));
            throw error;
        }
    }

    /**
     * Creates anonymous authentication context
     */
    createAnonymousContext(): AuthContext {
        return {
            sessionId: 'anonymous',
            roles: ['anon'],
            permissions: [],
            isAuthenticated: false,
        };
    }

    /**
     * Validates tool access based on authentication context
     */
    async validateToolAccess(
        authContext: AuthContext,
        toolName: string,
        toolArgs?: Record<string, unknown>
    ): Promise<void> {
        // Get required permissions for the tool
        const requiredPermission = this.rbacManager.getToolPermissions(toolName);
        
        // Check if user has required permission
        this.rbacManager.enforcePermission(
            authContext,
            requiredPermission.action,
            requiredPermission.resource,
            requiredPermission.conditions
        );

        // Check if tool requires human approval
        if (this.rbacManager.requiresHumanApproval(toolName, authContext)) {
            throw new AuthorizationError(
                `Tool ${toolName} requires human approval for non-admin users`,
                'AUTH_HUMAN_APPROVAL_REQUIRED'
            );
        }

        // Additional validation for SQL execution
        if (toolName === 'execute_sql' && toolArgs) {
            await this.validateSqlExecution(authContext, toolArgs);
        }

        console.error(`Access granted for tool ${toolName} to user ${authContext.userId || 'anonymous'}`);
    }

    /**
     * Validates SQL execution with additional security checks
     */
    private async validateSqlExecution(
        authContext: AuthContext,
        toolArgs: Record<string, unknown>
    ): Promise<void> {
        const query = toolArgs.query as string;
        
        if (!query) {
            throw new AuthorizationError('SQL query is required', 'AUTH_MISSING_QUERY');
        }

        // Check for dangerous SQL operations
        const dangerousPatterns = [
            /\bDROP\s+/i,
            /\bDELETE\s+FROM\s+/i,
            /\bTRUNCATE\s+/i,
            /\bALTER\s+/i,
            /\bGRANT\s+/i,
            /\bREVOKE\s+/i,
            /\bCREATE\s+USER\s+/i,
            /\bDROP\s+USER\s+/i,
        ];

        const isDangerous = dangerousPatterns.some(pattern => pattern.test(query));

        if (isDangerous) {
            // Only admin and service_role can execute dangerous SQL
            if (!authContext.roles.includes('admin') && !authContext.roles.includes('service_role')) {
                throw new AuthorizationError(
                    'Dangerous SQL operations require admin or service_role privileges',
                    'AUTH_DANGEROUS_SQL'
                );
            }
        }

        // For non-admin users, enforce read-only for SELECT statements only
        if (!authContext.roles.includes('admin') && !authContext.roles.includes('service_role')) {
            if (!/^\s*SELECT\s+/i.test(query.trim())) {
                throw new AuthorizationError(
                    'Non-admin users can only execute SELECT statements',
                    'AUTH_SELECT_ONLY'
                );
            }
        }
    }

    /**
     * Creates or validates session for authenticated user
     */
    private async createOrValidateSession(
        payload: JWTPayload,
        userAgent?: string,
        ipAddress?: string
    ): Promise<string> {
        try {
            // Create a new session for this authentication
            const session = await this.sessionManager.createSession(
                payload.sub,
                userAgent,
                ipAddress
            );
            return session.sessionId;
        } catch (error) {
            // If session creation fails due to limits, try to reuse existing session
            const existingSessions = await this.sessionManager.getUserSessions(payload.sub);
            if (existingSessions.length > 0) {
                return existingSessions[0].sessionId;
            }
            throw error;
        }
    }

    /**
     * Validates session and updates last access time
     */
    async validateSession(sessionId: string): Promise<SessionData | null> {
        return await this.sessionManager.validateSession(sessionId);
    }

    /**
     * Destroys session
     */
    async destroySession(sessionId: string): Promise<void> {
        await this.sessionManager.destroySession(sessionId);
    }

    /**
     * Validates token audience for specific operation
     */
    validateTokenAudience(authContext: AuthContext, requiredAudience: string): boolean {
        if (!authContext.tokenAudience) {
            return false;
        }

        // Support both single audience (string) and multiple audiences (array)
        const audiences = Array.isArray(authContext.tokenAudience) 
            ? authContext.tokenAudience 
            : [authContext.tokenAudience];
        
        return audiences.includes(requiredAudience);
    }

    /**
     * Gets RBAC manager for external use
     */
    getRBACManager(): RBACManager {
        return this.rbacManager;
    }

    /**
     * Gets session manager for external use
     */
    getSessionManager(): SessionManager {
        return this.sessionManager;
    }

    /**
     * Cleanup when shutting down
     */
    destroy(): void {
        this.sessionManager.destroy();
    }
}