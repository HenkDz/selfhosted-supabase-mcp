/**
 * JWT token validation and management
 */

import type { JWTPayload, AuthConfig } from './types.js';
import { AuthenticationError } from './types.js';

/**
 * Basic JWT validation without external dependencies
 * Note: In production, consider using a proper JWT library like 'jsonwebtoken'
 */
export class JWTValidator {
    private config: AuthConfig;

    constructor(config: AuthConfig) {
        this.config = config;
    }

    /**
     * Validates a JWT token and returns the payload
     */
    async validateToken(token: string): Promise<JWTPayload> {
        if (!token) {
            throw new AuthenticationError('No token provided', 'AUTH_NO_TOKEN');
        }

        // Basic JWT format validation
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new AuthenticationError('Invalid JWT format', 'AUTH_INVALID_FORMAT');
        }

        try {
            // Decode header and payload (signature validation would require crypto)
            const header = this.decodeBase64Url(parts[0]);
            const payload = this.decodeBase64Url(parts[1]);

            const parsedHeader = JSON.parse(header);
            const parsedPayload = JSON.parse(payload) as JWTPayload;

            // Basic validation
            this.validatePayload(parsedPayload);

            return parsedPayload;
        } catch (error) {
            throw new AuthenticationError(
                `Token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'AUTH_VALIDATION_FAILED'
            );
        }
    }

    /**
     * Validates JWT payload structure and claims
     */
    private validatePayload(payload: JWTPayload): void {
        const now = Math.floor(Date.now() / 1000);

        // Check required fields
        if (!payload.sub) {
            throw new AuthenticationError('Token missing subject (sub) claim', 'AUTH_MISSING_SUB');
        }

        if (!payload.aud) {
            throw new AuthenticationError('Token missing audience (aud) claim', 'AUTH_MISSING_AUD');
        }

        if (!payload.iss) {
            throw new AuthenticationError('Token missing issuer (iss) claim', 'AUTH_MISSING_ISS');
        }

        // Check expiration
        if (payload.exp && payload.exp < now) {
            throw new AuthenticationError('Token has expired', 'AUTH_TOKEN_EXPIRED');
        }

        // Check not before
        if (payload.iat && payload.iat > now + 60) { // Allow 60 seconds clock skew
            throw new AuthenticationError('Token not yet valid', 'AUTH_TOKEN_NOT_YET_VALID');
        }

        // Validate audience
        if (this.config.allowedAudiences.length > 0 && !this.config.allowedAudiences.includes(payload.aud)) {
            throw new AuthenticationError(
                `Invalid audience: ${payload.aud}`,
                'AUTH_INVALID_AUDIENCE'
            );
        }

        // Validate issuer
        if (this.config.allowedIssuers.length > 0 && !this.config.allowedIssuers.includes(payload.iss)) {
            throw new AuthenticationError(
                `Invalid issuer: ${payload.iss}`,
                'AUTH_INVALID_ISSUER'
            );
        }
    }

    /**
     * Decodes base64url without padding
     */
    private decodeBase64Url(str: string): string {
        // Add padding if needed
        str += '='.repeat((4 - str.length % 4) % 4);
        // Replace base64url characters with base64 characters
        str = str.replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(str, 'base64').toString();
    }

    /**
     * Extracts roles from JWT payload
     */
    extractRoles(payload: JWTPayload): string[] {
        const roles: string[] = [];

        // Check for single role claim
        if (payload.role && typeof payload.role === 'string') {
            roles.push(payload.role);
        }

        // Check for multiple roles claim
        if (payload.roles && Array.isArray(payload.roles)) {
            roles.push(...payload.roles.filter(role => typeof role === 'string'));
        }

        // Default role if none specified
        if (roles.length === 0) {
            roles.push('authenticated');
        }

        return [...new Set(roles)]; // Remove duplicates
    }

    /**
     * Extracts permissions from JWT payload
     */
    extractPermissions(payload: JWTPayload): string[] {
        if (payload.permissions && Array.isArray(payload.permissions)) {
            return payload.permissions.filter(permission => typeof permission === 'string');
        }
        return [];
    }

    /**
     * Validates token audience for specific operation
     * Implements RFC 8707 - OAuth 2.0 Resource Indicators
     */
    validateTokenAudience(payload: JWTPayload, requiredAudience: string): boolean {
        if (!payload.aud) {
            return false;
        }

        // Support both single audience (string) and multiple audiences (array)
        const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
        return audiences.includes(requiredAudience);
    }
}