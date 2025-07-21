/**
 * Authentication framework types and interfaces
 */

export interface AuthContext {
    userId?: string;
    sessionId: string;
    roles: string[];
    permissions: string[];
    isAuthenticated: boolean;
    tokenAudience?: string;
    tokenIssuer?: string;
    tokenSubject?: string;
    tokenExpires?: Date;
    sessionExpires?: Date;
}

export interface JWTPayload {
    sub: string; // subject (user ID)
    aud: string; // audience
    iss: string; // issuer
    exp: number; // expiration time
    iat: number; // issued at
    jti?: string; // JWT ID
    role?: string; // user role
    roles?: string[]; // multiple roles
    permissions?: string[]; // explicit permissions
}

export interface SessionData {
    sessionId: string;
    userId: string;
    createdAt: Date;
    lastAccessedAt: Date;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
    isActive: boolean;
}

export interface Permission {
    action: string; // e.g., 'read', 'write', 'execute'
    resource: string; // e.g., 'auth_users', 'sql', 'migrations'
    conditions?: Record<string, unknown>; // additional conditions
}

export interface Role {
    name: string;
    description: string;
    permissions: Permission[];
    isSystemRole: boolean; // cannot be deleted/modified
}

export interface AuditEvent {
    eventId: string;
    timestamp: Date;
    userId?: string;
    sessionId?: string;
    action: string;
    resource: string;
    outcome: 'success' | 'failure' | 'error';
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
}

export interface AuthConfig {
    jwtSecret: string;
    sessionTimeout: number; // in milliseconds
    maxConcurrentSessions: number;
    enableAuditLogging: boolean;
    allowedAudiences: string[];
    allowedIssuers: string[];
    requireHumanApproval: string[]; // operations requiring human approval
}

export interface CredentialMaskingOptions {
    maskingCharacter: string;
    visibleCharacters: number; // number of characters to show at start/end
    enableMasking: boolean;
}

// Error types for authentication
export class AuthenticationError extends Error {
    constructor(message: string, public code?: string) {
        super(message);
        this.name = 'AuthenticationError';
    }
}

export class AuthorizationError extends Error {
    constructor(message: string, public code?: string) {
        super(message);
        this.name = 'AuthorizationError';
    }
}

export class SessionError extends Error {
    constructor(message: string, public code?: string) {
        super(message);
        this.name = 'SessionError';
    }
}