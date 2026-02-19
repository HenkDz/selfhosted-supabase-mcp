# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **HTTP Transport Mode**: Run MCP server in HTTP mode for Docker/Kong integration
  - Express-based HTTP server with Streamable HTTP Transport
  - Configurable CORS, rate limiting, and request timeouts
  - Health check endpoint for container orchestration
- **JWT Authentication Middleware**: Validate Supabase JWTs in HTTP mode
- **Privilege-Based Access Control**: Role-based tool access (regular, privileged)
  - `service_role`: Access to all tools
  - `authenticated`/`anon`: Access to regular tools only
- **24 New Database Introspection Tools**:
  - Schema: `list_table_columns`, `list_indexes`, `list_constraints`, `list_foreign_keys`, `list_triggers`, `list_database_functions`, `list_available_extensions`
  - Security: `list_rls_policies`, `get_rls_status`, `get_advisors`
  - Definitions: `get_function_definition`, `get_trigger_definition`
  - Performance: `get_index_stats`, `get_vector_index_stats`, `explain_query`
  - Extensions: `list_cron_jobs`, `get_cron_job_history`, `list_vector_indexes`
  - Edge Functions: `list_edge_functions`, `get_edge_function_details`, `list_edge_function_logs`
  - Storage: `get_storage_config`, `update_storage_config`
  - Logs: `get_logs`
- **Bun Runtime**: Migrated from Node.js/npm to Bun for faster builds and execution
- **Comprehensive Test Suite**: 13 test files with 240+ passing tests
- **Docker Integration**: Dockerfile and Docker Compose configuration for self-hosted Supabase stacks

### Changed

- `execute_sql` now requires `service_role` JWT in HTTP mode (privileged tool)
- Replaced `package-lock.json` with `bun.lock`

### Removed

- **`get_anon_key` tool**: Removed to prevent exposure of sensitive API keys through MCP
- **`get_service_key` tool**: Removed to prevent exposure of sensitive API keys through MCP

### Security

- Removed tools that exposed API keys (`get_anon_key`, `get_service_key`)
  - **Rationale**: MCP tools can be called by any connected client. Exposing API keys through MCP creates a security risk where keys could be extracted by malicious or compromised MCP clients. The anon key and service role key are already available to the server at startup via environment variables or CLI arguments - there's no legitimate use case for retrieving them via MCP during runtime.
- Added privilege-based access control to restrict sensitive operations to `service_role` only
- JWT authentication enforced for all HTTP mode requests
- All SQL queries use parameterised queries / prepared statements — SQL injection is not possible (#7)
- Passwords are bcrypt-hashed via `pgcrypto` before being stored in `auth.users` — no plain-text handling (#8)
- HTTP rate limiting, CORS restrictions, and request timeouts are configurable via CLI flags (#10)

### Resolved Issues

The following issues were resolved by prior code and documentation work and are now closed:

- #5 — Coolify / reverse-proxy `ECONNRESET` on startup: graceful degradation documented in README
- #6, #13 — Secure authentication framework: JWT auth + RBAC implemented and documented
- #7 — SQL injection: all queries use parameterised statements
- #8 — Plain-text password handling: passwords are bcrypt-hashed via `pgcrypto`
- #10 — Rate limiting & resource controls: `--rate-limit-*`, `--cors-origins`, `--request-timeout` flags added
- #11 — Audit logging: out of scope for this minimal MCP server; closed as won't-fix
- #12 — CI/CD security pipeline: out of scope for this repository; closed as won't-fix
- #17 — Missing tool documentation: full 44-tool table added to README
- #18 — `supabase_migrations.schema_migrations` origin: dedicated README section added
