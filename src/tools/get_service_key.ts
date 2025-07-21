import { z } from 'zod';
import type { SelfhostedSupabaseClient } from '../client/index.js';
import type { ToolContext } from './types.js';
import { maskCredential } from '../auth/credentials.js';

// Input schema (none needed)
const GetServiceKeyInputSchema = z.object({});
type GetServiceKeyInput = z.infer<typeof GetServiceKeyInputSchema>;

// Output schema
const GetServiceKeyOutputSchema = z.object({
    service_key_status: z.enum(['found', 'not_configured']).describe('Whether the service key was provided to the server.'),
    service_key_masked: z.string().optional().describe('The masked service role key (for security).'),
    service_key_length: z.number().optional().describe('Length of the actual service key.'),
});

// Static JSON Schema for MCP capabilities
const mcpInputSchema = {
    type: 'object',
    properties: {},
    required: [],
};

// The tool definition
export const getServiceKeyTool = {
    name: 'get_service_key',
    description: 'Returns masked information about the configured Supabase service role key for this server, if available. The actual key is never exposed for security reasons.',
    inputSchema: GetServiceKeyInputSchema,
    mcpInputSchema: mcpInputSchema,
    outputSchema: GetServiceKeyOutputSchema,
    execute: async (input: GetServiceKeyInput, context: ToolContext) => {
        const client = context.selfhostedClient;
        const key = client.getServiceRoleKey();
        
        if (key) {
            return { 
                service_key_status: 'found', 
                service_key_masked: maskCredential(key),
                service_key_length: key.length
            };
        }
        return { service_key_status: 'not_configured' };
    },
};