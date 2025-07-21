import { z } from 'zod';
import type { SelfhostedSupabaseClient } from '../client/index.js';
import type { ToolContext } from './types.js';
import { maskCredential } from '../auth/credentials.js';

// Input schema (none needed)
const VerifyJwtInputSchema = z.object({});
type VerifyJwtInput = z.infer<typeof VerifyJwtInputSchema>;

// Output schema
const VerifyJwtOutputSchema = z.object({
    jwt_secret_status: z.enum(['found', 'not_configured']).describe('Whether the JWT secret was provided to the server.'),
    jwt_secret_masked: z.string().optional().describe('The masked JWT secret (for security).'),
    jwt_secret_length: z.number().optional().describe('Length of the actual JWT secret.'),
});

// Static JSON Schema for MCP capabilities
const mcpInputSchema = {
    type: 'object',
    properties: {},
    required: [],
};

// The tool definition
export const verifyJwtSecretTool = {
    name: 'verify_jwt_secret',
    description: 'Checks if the Supabase JWT secret is configured for this server and returns masked information. The actual secret is never exposed for security reasons.',
    inputSchema: VerifyJwtInputSchema,
    mcpInputSchema: mcpInputSchema,
    outputSchema: VerifyJwtOutputSchema,
    execute: async (input: VerifyJwtInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const secret = client.getJwtSecret();

        if (secret) {
            return {
                jwt_secret_status: 'found',
                jwt_secret_masked: maskCredential(secret),
                jwt_secret_length: secret.length,
            };
        }

        return { jwt_secret_status: 'not_configured' };
    },
};