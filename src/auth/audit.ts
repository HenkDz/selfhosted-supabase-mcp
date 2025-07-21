/**
 * Audit logging for authentication and authorization events
 */

import type { AuditEvent, AuthContext } from './types.js';

/**
 * Audit logger that tracks security-relevant events
 */
export class AuditLogger {
    private events: AuditEvent[] = [];
    private maxEvents: number = 10000; // Keep last 10k events in memory
    private enabled: boolean = true;

    constructor(enabled: boolean = true, maxEvents: number = 10000) {
        this.enabled = enabled;
        this.maxEvents = maxEvents;
    }

    /**
     * Logs an authentication event
     */
    async logAuthEvent(
        action: string,
        outcome: 'success' | 'failure' | 'error',
        authContext?: AuthContext,
        details?: Record<string, unknown>,
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        if (!this.enabled) return;

        const event: AuditEvent = {
            eventId: this.generateEventId(),
            timestamp: new Date(),
            userId: authContext?.userId,
            sessionId: authContext?.sessionId,
            action,
            resource: 'authentication',
            outcome,
            details: this.sanitizeDetails(details),
            ipAddress,
            userAgent,
        };

        this.addEvent(event);
        this.logToConsole(event);
    }

    /**
     * Logs an authorization event
     */
    async logAuthzEvent(
        action: string,
        resource: string,
        outcome: 'success' | 'failure' | 'error',
        authContext: AuthContext,
        details?: Record<string, unknown>,
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        if (!this.enabled) return;

        const event: AuditEvent = {
            eventId: this.generateEventId(),
            timestamp: new Date(),
            userId: authContext.userId,
            sessionId: authContext.sessionId,
            action,
            resource,
            outcome,
            details: this.sanitizeDetails(details),
            ipAddress,
            userAgent,
        };

        this.addEvent(event);
        this.logToConsole(event);
    }

    /**
     * Logs a tool execution event
     */
    async logToolEvent(
        toolName: string,
        outcome: 'success' | 'failure' | 'error',
        authContext: AuthContext,
        details?: Record<string, unknown>,
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        if (!this.enabled) return;

        const event: AuditEvent = {
            eventId: this.generateEventId(),
            timestamp: new Date(),
            userId: authContext.userId,
            sessionId: authContext.sessionId,
            action: 'tool_execution',
            resource: toolName,
            outcome,
            details: this.sanitizeDetails(details),
            ipAddress,
            userAgent,
        };

        this.addEvent(event);
        this.logToConsole(event);
    }

    /**
     * Logs a session event
     */
    async logSessionEvent(
        action: 'session_created' | 'session_validated' | 'session_destroyed' | 'session_expired',
        outcome: 'success' | 'failure' | 'error',
        sessionId: string,
        userId?: string,
        details?: Record<string, unknown>,
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        if (!this.enabled) return;

        const event: AuditEvent = {
            eventId: this.generateEventId(),
            timestamp: new Date(),
            userId,
            sessionId,
            action,
            resource: 'session',
            outcome,
            details: this.sanitizeDetails(details),
            ipAddress,
            userAgent,
        };

        this.addEvent(event);
        this.logToConsole(event);
    }

    /**
     * Gets recent audit events
     */
    getRecentEvents(limit: number = 100): AuditEvent[] {
        return this.events.slice(-limit);
    }

    /**
     * Gets events for a specific user
     */
    getUserEvents(userId: string, limit: number = 100): AuditEvent[] {
        return this.events
            .filter(event => event.userId === userId)
            .slice(-limit);
    }

    /**
     * Gets events for a specific session
     */
    getSessionEvents(sessionId: string): AuditEvent[] {
        return this.events.filter(event => event.sessionId === sessionId);
    }

    /**
     * Gets failed authentication attempts
     */
    getFailedAuthAttempts(since?: Date): AuditEvent[] {
        const sinceTime = since || new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
        return this.events.filter(event => 
            event.resource === 'authentication' &&
            event.outcome === 'failure' &&
            event.timestamp >= sinceTime
        );
    }

    /**
     * Gets events by action type
     */
    getEventsByAction(action: string, limit: number = 100): AuditEvent[] {
        return this.events
            .filter(event => event.action === action)
            .slice(-limit);
    }

    /**
     * Gets security statistics
     */
    getSecurityStats(since?: Date): {
        totalEvents: number;
        authSuccesses: number;
        authFailures: number;
        authzFailures: number;
        uniqueUsers: number;
        uniqueSessions: number;
    } {
        const sinceTime = since || new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
        const recentEvents = this.events.filter(event => event.timestamp >= sinceTime);

        const authSuccesses = recentEvents.filter(e => 
            e.resource === 'authentication' && e.outcome === 'success'
        ).length;

        const authFailures = recentEvents.filter(e => 
            e.resource === 'authentication' && e.outcome === 'failure'
        ).length;

        const authzFailures = recentEvents.filter(e => 
            e.action.includes('authz') && e.outcome === 'failure'
        ).length;

        const uniqueUsers = new Set(
            recentEvents.map(e => e.userId).filter(Boolean)
        ).size;

        const uniqueSessions = new Set(
            recentEvents.map(e => e.sessionId).filter(Boolean)
        ).size;

        return {
            totalEvents: recentEvents.length,
            authSuccesses,
            authFailures,
            authzFailures,
            uniqueUsers,
            uniqueSessions,
        };
    }

    /**
     * Adds an event to the log with rotation
     */
    private addEvent(event: AuditEvent): void {
        this.events.push(event);
        
        // Rotate events if we exceed max size
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }
    }

    /**
     * Generates a unique event ID
     */
    private generateEventId(): string {
        return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Sanitizes details object to remove sensitive information
     */
    private sanitizeDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
        if (!details) return undefined;

        const sanitized: Record<string, unknown> = {};
        const sensitiveKeys = ['password', 'secret', 'key', 'token', 'credential'];

        for (const [key, value] of Object.entries(details)) {
            const isSensitive = sensitiveKeys.some(sensitive => 
                key.toLowerCase().includes(sensitive)
            );

            if (isSensitive && typeof value === 'string') {
                sanitized[key] = `[REDACTED:${value.length}chars]`;
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    /**
     * Logs event to console with structured format
     */
    private logToConsole(event: AuditEvent): void {
        const logLevel = event.outcome === 'success' ? 'INFO' : 'WARN';
        const timestamp = event.timestamp.toISOString();
        const user = event.userId || 'anonymous';
        const session = event.sessionId || 'none';
        
        console.error(`[${logLevel}] [AUDIT] ${timestamp} | ${event.action} | ${event.resource} | ${event.outcome} | User: ${user} | Session: ${session}`);
        
        if (event.details) {
            console.error(`[${logLevel}] [AUDIT] Details:`, JSON.stringify(event.details, null, 2));
        }
    }

    /**
     * Exports audit log for external storage/analysis
     */
    exportLog(format: 'json' | 'csv' = 'json'): string {
        if (format === 'json') {
            return JSON.stringify(this.events, null, 2);
        }

        if (format === 'csv') {
            const headers = ['eventId', 'timestamp', 'userId', 'sessionId', 'action', 'resource', 'outcome', 'ipAddress', 'userAgent'];
            const rows = this.events.map(event => [
                event.eventId,
                event.timestamp.toISOString(),
                event.userId || '',
                event.sessionId || '',
                event.action,
                event.resource,
                event.outcome,
                event.ipAddress || '',
                event.userAgent || '',
            ]);

            return [headers, ...rows].map(row => row.join(',')).join('\n');
        }

        throw new Error(`Unsupported export format: ${format}`);
    }

    /**
     * Clears the audit log
     */
    clearLog(): void {
        this.events = [];
    }

    /**
     * Enables or disables audit logging
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }
}