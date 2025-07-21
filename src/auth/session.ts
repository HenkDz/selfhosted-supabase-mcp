/**
 * Session management and validation
 */

import type { SessionData, AuthConfig } from './types.js';
import { SessionError } from './types.js';
import { generateSecureSessionId } from './credentials.js';

/**
 * In-memory session store for demonstration
 * In production, use Redis or database-backed session store
 */
export class SessionManager {
    private sessions = new Map<string, SessionData>();
    private userSessions = new Map<string, Set<string>>(); // userId -> sessionIds
    private config: AuthConfig;
    private cleanupInterval?: NodeJS.Timeout;

    constructor(config: AuthConfig) {
        this.config = config;
        this.startCleanupTimer();
    }

    /**
     * Creates a new session for a user
     */
    async createSession(
        userId: string,
        userAgent?: string,
        ipAddress?: string
    ): Promise<SessionData> {
        // Check concurrent session limit
        const existingSessions = this.userSessions.get(userId) || new Set();
        if (existingSessions.size >= this.config.maxConcurrentSessions) {
            throw new SessionError(
                `Maximum concurrent sessions (${this.config.maxConcurrentSessions}) exceeded`,
                'SESSION_LIMIT_EXCEEDED'
            );
        }

        const sessionId = await generateSecureSessionId();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.config.sessionTimeout);

        const sessionData: SessionData = {
            sessionId,
            userId,
            createdAt: now,
            lastAccessedAt: now,
            expiresAt,
            userAgent,
            ipAddress,
            isActive: true,
        };

        this.sessions.set(sessionId, sessionData);

        // Track user sessions
        if (!this.userSessions.has(userId)) {
            this.userSessions.set(userId, new Set());
        }
        this.userSessions.get(userId)!.add(sessionId);

        return sessionData;
    }

    /**
     * Validates and retrieves session data
     */
    async validateSession(sessionId: string): Promise<SessionData | null> {
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            return null;
        }

        // Check if session is expired
        if (session.expiresAt < new Date() || !session.isActive) {
            await this.destroySession(sessionId);
            return null;
        }

        // Update last accessed time
        session.lastAccessedAt = new Date();
        session.expiresAt = new Date(Date.now() + this.config.sessionTimeout);

        return session;
    }

    /**
     * Destroys a session
     */
    async destroySession(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (session) {
            // Remove from user sessions tracking
            const userSessions = this.userSessions.get(session.userId);
            if (userSessions) {
                userSessions.delete(sessionId);
                if (userSessions.size === 0) {
                    this.userSessions.delete(session.userId);
                }
            }
        }

        this.sessions.delete(sessionId);
    }

    /**
     * Destroys all sessions for a user
     */
    async destroyUserSessions(userId: string): Promise<void> {
        const userSessions = this.userSessions.get(userId);
        if (userSessions) {
            for (const sessionId of userSessions) {
                this.sessions.delete(sessionId);
            }
            this.userSessions.delete(userId);
        }
    }

    /**
     * Gets all active sessions for a user
     */
    async getUserSessions(userId: string): Promise<SessionData[]> {
        const userSessions = this.userSessions.get(userId);
        if (!userSessions) {
            return [];
        }

        const sessions: SessionData[] = [];
        for (const sessionId of userSessions) {
            const session = await this.validateSession(sessionId);
            if (session) {
                sessions.push(session);
            }
        }

        return sessions;
    }

    /**
     * Extends session expiration
     */
    async extendSession(sessionId: string): Promise<boolean> {
        const session = this.sessions.get(sessionId);
        if (!session || !session.isActive) {
            return false;
        }

        session.expiresAt = new Date(Date.now() + this.config.sessionTimeout);
        session.lastAccessedAt = new Date();
        return true;
    }

    /**
     * Gets session statistics
     */
    getSessionStats(): { totalSessions: number; userCount: number; expiredSessions: number } {
        const now = new Date();
        let expiredSessions = 0;

        for (const session of this.sessions.values()) {
            if (session.expiresAt < now || !session.isActive) {
                expiredSessions++;
            }
        }

        return {
            totalSessions: this.sessions.size,
            userCount: this.userSessions.size,
            expiredSessions,
        };
    }

    /**
     * Validates session binding to user information
     * Helps prevent session hijacking
     */
    validateSessionBinding(
        sessionId: string,
        userAgent?: string,
        ipAddress?: string
    ): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return false;
        }

        // Check user agent if stored
        if (session.userAgent && userAgent && session.userAgent !== userAgent) {
            return false;
        }

        // Check IP address if stored (be careful with this due to NAT/proxies)
        if (session.ipAddress && ipAddress && session.ipAddress !== ipAddress) {
            return false;
        }

        return true;
    }

    /**
     * Starts the cleanup timer for expired sessions
     */
    private startCleanupTimer(): void {
        // Clean up expired sessions every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions();
        }, 5 * 60 * 1000);
    }

    /**
     * Removes expired sessions from memory
     */
    private cleanupExpiredSessions(): void {
        const now = new Date();
        const expiredSessionIds: string[] = [];

        for (const [sessionId, session] of this.sessions.entries()) {
            if (session.expiresAt < now || !session.isActive) {
                expiredSessionIds.push(sessionId);
            }
        }

        for (const sessionId of expiredSessionIds) {
            this.destroySession(sessionId);
        }

        if (expiredSessionIds.length > 0) {
            console.error(`Cleaned up ${expiredSessionIds.length} expired sessions`);
        }
    }

    /**
     * Cleanup when shutting down
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.sessions.clear();
        this.userSessions.clear();
    }
}