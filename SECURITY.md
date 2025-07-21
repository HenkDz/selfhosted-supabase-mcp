# Secure Authentication Framework - Usage Examples

## Quick Start

### 1. Secure Mode (Recommended for Production)

```bash
# Start with authentication enabled
node dist/index.js \
  --url "https://your-project.supabase.co" \
  --anon-key "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  --service-key "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  --jwt-secret "your-jwt-secret" \
  --auth-token "valid-jwt-token-here"
```

### 2. Development Mode (For Testing Only)

```bash
# Start with authentication disabled (NOT RECOMMENDED for production)
node dist/index.js \
  --url "https://your-project.supabase.co" \
  --anon-key "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  --disable-auth
```

## Security Improvements Demonstrated

### Before (Vulnerable)
```json
{
  "anon_key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdXItcHJvamVjdC1pZCIsInJvbGUiOiJhbm9uIn0.FULL_EXPOSED_KEY"
}
```

### After (Secure)
```json
{
  "anon_key_masked": "eyJh************************************************************************************************************In0.FULL_EXPOSED_KEY",
  "anon_key_length": 155
}
```

## Role-Based Access Control

### Available Roles

1. **anon** - Anonymous users
   - Can read public data only

2. **authenticated** - Authenticated users  
   - Can read basic resources
   - Limited write access

3. **operator** - Database operators
   - Can execute SQL (read-only for non-admin)
   - Can manage migrations
   - Cannot access sensitive credentials

4. **service_role** - Service accounts
   - Can manage auth users
   - Can execute any SQL
   - Can access most resources

5. **admin** - Full administrators
   - Can access all resources
   - Can execute dangerous SQL operations
   - Bypasses human approval requirements

## Session Management

- **Secure Session IDs**: Non-deterministic, cryptographically secure
- **Session Timeout**: Configurable (default: 24 hours)
- **Concurrent Limits**: Maximum sessions per user (default: 5)
- **Session Binding**: Tied to user agent and IP for security

## Audit Logging

All security events are logged:
- Authentication attempts (success/failure)
- Authorization decisions  
- Tool executions
- Session lifecycle events
- Credential access attempts

## Human-in-the-Loop Controls

Dangerous operations require human approval for non-admin users:
- `delete_auth_user`
- `apply_migration`
- Destructive SQL operations

## Testing Your Setup

Run the included security tests:

```bash
# Test server startup
node test/server-test.js

# Test credential masking
node test/credential-test.js
```

## Configuration Files

### Tool Whitelist (recommended)
```json
{
  "enabledTools": [
    "list_tables",
    "get_database_stats", 
    "get_project_url"
  ]
}
```

Use with: `--tools-config /path/to/config.json`

## Environment Variables

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-service-key"
export SUPABASE_AUTH_JWT_SECRET="your-jwt-secret"
export MCP_AUTH_TOKEN="valid-jwt-token"
```

## Security Best Practices

1. **Always use authentication in production**
2. **Rotate JWT secrets regularly**
3. **Limit tool access with configuration files**
4. **Monitor audit logs for suspicious activity**
5. **Use service roles only when necessary**
6. **Implement proper JWT token validation in clients**

## Troubleshooting

### Authentication Disabled Warning
```
WARNING: Authentication is disabled. This is NOT RECOMMENDED for production use.
```
**Solution**: Remove `--disable-auth` and provide `--jwt-secret` and `--auth-token`

### Authentication Framework Not Initialized
**Solution**: Ensure JWT secret is provided via `--jwt-secret` or `SUPABASE_AUTH_JWT_SECRET`

### Access Denied Errors
**Solution**: Check user roles and permissions, ensure JWT token has appropriate claims