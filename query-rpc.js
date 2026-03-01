import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://api.belajarcarabelajar.com';
const supabaseKey = 'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpc3MiOiAic3VwYWJhc2UiLCAiaWF0IjogMTc0MzQ4MDAwMCwgImV4cCI6IDE5MDEyNDY0MDB9.kXx8fSjH6eCH57CYEw_jQT73wy2U2CDzQKlUxKSbjBg'; // service key

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
    const listTablesSql = `
            SELECT
                n.nspname as schema,
                c.relname as name
            FROM
                pg_catalog.pg_class c
            JOIN
                pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE
                c.relkind = 'r'
                AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
                AND n.nspname NOT LIKE 'pg_temp_%'
                AND n.nspname NOT LIKE 'pg_toast_temp_%'
                AND n.nspname NOT IN ('auth', 'storage', 'extensions', 'graphql', 'graphql_public', 'pgbouncer', 'realtime', 'supabase_functions', 'supabase_migrations', '_realtime')
            ORDER BY
                n.nspname,
                c.relname
        `;

    // In case execute_sql is failing to return json properly, we can try to wrap it to return text
    // The previous error was token "net" is invalid, this is often a sign of PostgREST
    // attempting to parse a string that isn't valid JSON.
    const wrappedQuery = `SELECT json_agg(t)::text as result FROM (${listTablesSql}) t`;

    const { data, error } = await supabase.rpc('execute_sql', { query: wrappedQuery });
    if (error) {
        console.error('RPC Error:', error);
        return;
    }

    console.log("Raw data:", data);

    let parsedData = data;
    if (Array.isArray(data) && data.length > 0 && data[0].result) {
        try {
            parsedData = JSON.parse(data[0].result);
        } catch (e) {
            console.error("Failed to parse result:", e);
        }
    }

    const schemas = {};
    for (const row of Array.isArray(parsedData) ? parsedData : []) {
        if (!schemas[row.schema]) schemas[row.schema] = [];
        schemas[row.schema].push(row.name);
    }

    for (const [schema, tables] of Object.entries(schemas)) {
        console.log(`Schema: ${schema}`);
        for (const table of tables) {
            console.log(`  - ${table}`);
        }
    }
}

listTables();
