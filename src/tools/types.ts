import type { SelfhostedSupabaseClient } from '../client/index.js';
import type { AuthContext } from '../auth/types.js';

// Define log function type
type LogFunction = (message: string, level?: 'info' | 'warn' | 'error') => void;

/**
 * Defines the expected shape of the context object passed to tool execute functions.
 */
export interface ToolContext {
    selfhostedClient: SelfhostedSupabaseClient;
    log: LogFunction; // Explicitly define the log function
    workspacePath?: string; // Path to the workspace root
    auth: AuthContext; // Authentication context for security
    [key: string]: unknown; // Allow other context properties, though log is now typed
}