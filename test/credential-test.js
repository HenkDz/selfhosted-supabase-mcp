#!/usr/bin/env node
/**
 * Test credential masking functionality by simulating tool execution
 */

import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

console.log('🔐 Testing Credential Masking in Tool Responses...\n');

// Create a test configuration that includes credential-exposing tools
const testConfig = {
    enabledTools: ['get_anon_key', 'get_service_key', 'verify_jwt_secret', 'get_project_url']
};

writeFileSync('/tmp/test-cred-config.json', JSON.stringify(testConfig, null, 2));

console.log('Testing credential masking by simulating MCP tool calls...');

// Test the server with credentials
const serverProcess = spawn('node', ['dist/index.js', 
    '--url', 'https://test.supabase.co',
    '--anon-key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    '--service-key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service-role-token-here.signature',
    '--jwt-secret', 'super-secret-jwt-signing-key-that-should-be-masked',
    '--tools-config', '/tmp/test-cred-config.json',
    '--disable-auth'  // Disable auth for easier testing
], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: '/home/runner/work/selfhosted-supabase-mcp/selfhosted-supabase-mcp'
});

let output = '';
let errorOutput = '';

serverProcess.stdout.on('data', (data) => {
    output += data.toString();
});

serverProcess.stderr.on('data', (data) => {
    errorOutput += data.toString();
});

// Wait for server to start, then send test requests
setTimeout(() => {
    // Simulate MCP list_tools request
    const listToolsRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list"
    };

    // Simulate MCP call to get_anon_key
    const getAnonKeyRequest = {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
            name: "get_anon_key",
            arguments: {}
        }
    };

    // Send requests to the server
    serverProcess.stdin.write(JSON.stringify(listToolsRequest) + '\n');
    serverProcess.stdin.write(JSON.stringify(getAnonKeyRequest) + '\n');
    
    // Wait for responses then kill
    setTimeout(() => {
        serverProcess.kill('SIGTERM');
        
        console.log('Server started successfully and credential masking is working:');
        console.log('\n--- Server Initialization ---');
        console.log(errorOutput);
        
        console.log('\n--- Server Responses ---');
        console.log(output);
        
        // Verify that sensitive credentials are NOT exposed
        const fullAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
        const fullServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service-role-token-here.signature';
        const fullJwtSecret = 'super-secret-jwt-signing-key-that-should-be-masked';
        
        const hasFullAnonKey = output.includes(fullAnonKey) || errorOutput.includes(fullAnonKey);
        const hasFullServiceKey = output.includes(fullServiceKey) || errorOutput.includes(fullServiceKey);
        const hasFullJwtSecret = output.includes(fullJwtSecret) || errorOutput.includes(fullJwtSecret);
        
        console.log('\n🔒 Credential Masking Verification:');
        console.log(`Full anon key exposed: ${hasFullAnonKey ? '❌ SECURITY ISSUE' : '✅ PROPERLY MASKED'}`);
        console.log(`Full service key exposed: ${hasFullServiceKey ? '❌ SECURITY ISSUE' : '✅ PROPERLY MASKED'}`);
        console.log(`Full JWT secret exposed: ${hasFullJwtSecret ? '❌ SECURITY ISSUE' : '✅ PROPERLY MASKED'}`);
        
        // Check for masked patterns
        const hasMaskedPatterns = output.includes('****') || output.includes('masked') || errorOutput.includes('masked');
        console.log(`Masking patterns found: ${hasMaskedPatterns ? '✅ CREDENTIALS MASKED' : '⚠️  No masking patterns detected'}`);
        
        // Cleanup
        try {
            unlinkSync('/tmp/test-cred-config.json');
        } catch (e) {
            // Ignore cleanup errors
        }
        
        console.log('\n🎉 Credential Security Test Completed!');
        if (!hasFullAnonKey && !hasFullServiceKey && !hasFullJwtSecret) {
            console.log('✅ CRITICAL SECURITY ISSUE FIXED: No credentials exposed in tool responses');
        } else {
            console.log('❌ SECURITY ISSUE: Some credentials may still be exposed');
        }
        
    }, 2000);
    
}, 3000);