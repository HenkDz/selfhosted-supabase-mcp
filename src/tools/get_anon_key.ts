import { z } from 'zod';
import type { SelfhostedSupabaseClient } from '../client/index.js';
import type { ToolContext } from './types.js';
import { maskCredential } from '../auth/credentials.js';

// Input schema (none needed)
const GetAnonKeyInputSchema = z.object({});
type GetAnonKeyInput = z.infer<typeof GetAnonKeyInputSchema>;

// Output schema
const GetAnonKeyOutputSchema = z.object({
    anon_key_masked: z.string().describe('The masked anonymous key (for security).'),
    anon_key_length: z.number().describe('Length of the actual anonymous key.'),
});

// Static JSON Schema for MCP capabilities
const mcpInputSchema = {
    type: 'object',
    properties: {},
    required: [],
};

// The tool definition
export const getAnonKeyTool = {
    name: 'get_anon_key',
    description: 'Returns masked information about the configured Supabase anonymous key for this server. The actual key is never exposed for security reasons.',
    inputSchema: GetAnonKeyInputSchema,
    mcpInputSchema: mcpInputSchema,
    outputSchema: GetAnonKeyOutputSchema,
    execute: async (input: GetAnonKeyInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const key = client.getAnonKey(); // Use getter from client
        return { 
            anon_key_masked: maskCredential(key),
            anon_key_length: key.length
        };
    },
};