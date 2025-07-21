/**
 * Credential masking and security utilities
 */

import type { CredentialMaskingOptions } from './types.js';

const DEFAULT_MASKING_OPTIONS: CredentialMaskingOptions = {
    maskingCharacter: '*',
    visibleCharacters: 4,
    enableMasking: true,
};

/**
 * Masks sensitive credential strings
 */
export function maskCredential(credential: string, options: Partial<CredentialMaskingOptions> = {}): string {
    const opts = { ...DEFAULT_MASKING_OPTIONS, ...options };
    
    if (!opts.enableMasking || !credential) {
        return credential;
    }

    const length = credential.length;
    
    // For very short credentials, mask everything except first character
    if (length <= opts.visibleCharacters) {
        return credential.charAt(0) + opts.maskingCharacter.repeat(Math.max(0, length - 1));
    }

    // Show first and last few characters, mask the middle
    const visibleStart = credential.substring(0, opts.visibleCharacters);
    const visibleEnd = credential.substring(length - opts.visibleCharacters);
    const maskedMiddle = opts.maskingCharacter.repeat(Math.max(0, length - (opts.visibleCharacters * 2)));
    
    return visibleStart + maskedMiddle + visibleEnd;
}

/**
 * Masks sensitive fields in an object recursively
 */
export function maskSensitiveFields(
    obj: Record<string, unknown>, 
    sensitiveFields: string[] = ['key', 'secret', 'token', 'password', 'credential'],
    options: Partial<CredentialMaskingOptions> = {}
): Record<string, unknown> {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj)) {
        const isKeyLowerCase = key.toLowerCase();
        const isSensitiveField = sensitiveFields.some(field => 
            isKeyLowerCase.includes(field.toLowerCase())
        );

        if (isSensitiveField && typeof value === 'string') {
            result[key] = maskCredential(value, options);
        } else if (Array.isArray(value)) {
            result[key] = value.map(item => 
                typeof item === 'object' && item !== null 
                    ? maskSensitiveFields(item as Record<string, unknown>, sensitiveFields, options)
                    : item
            );
        } else if (typeof value === 'object' && value !== null) {
            result[key] = maskSensitiveFields(value as Record<string, unknown>, sensitiveFields, options);
        } else {
            result[key] = value;
        }
    }

    return result;
}

/**
 * Validates credential format and strength
 */
export function validateCredential(credential: string, type: 'jwt' | 'api_key' | 'service_key'): { valid: boolean; reason?: string } {
    if (!credential || typeof credential !== 'string') {
        return { valid: false, reason: 'Credential must be a non-empty string' };
    }

    // Minimum length check
    if (credential.length < 32) {
        return { valid: false, reason: 'Credential is too short (minimum 32 characters)' };
    }

    switch (type) {
        case 'jwt':
            // Basic JWT format validation
            const parts = credential.split('.');
            if (parts.length !== 3) {
                return { valid: false, reason: 'Invalid JWT format (must have 3 parts separated by dots)' };
            }
            break;
        
        case 'api_key':
        case 'service_key':
            // Check for common patterns in Supabase keys
            if (!credential.startsWith('eyJ') && !credential.includes('_')) {
                return { valid: false, reason: 'Invalid API key format' };
            }
            break;
    }

    return { valid: true };
}

/**
 * Sanitizes credential for safe logging (completely masks it)
 */
export function sanitizeCredentialForLogging(credential: string): string {
    if (!credential) return '';
    return `[CREDENTIAL:${credential.length}chars:${credential.substring(0, 4)}...]`;
}

/**
 * Generates a secure random session ID
 */
export async function generateSecureSessionId(): Promise<string> {
    // Use Node.js crypto for secure random generation
    const crypto = await import('node:crypto');
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function secureStringCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
}