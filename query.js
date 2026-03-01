import { Client } from 'pg';

const client = new Client({
    connectionString: 'postgresql://postgres:dedbf69b63b5e3dcf118fee4eb50a8e0c36b37e2@43.157.235.59:6543/postgres'
});

async function main() {
    await client.connect();
    const res = await client.query(`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_schema NOT IN ('information_schema', 'pg_catalog') 
    ORDER BY table_schema, table_name;
  `);

    const schemas = {};
    for (const row of res.rows) {
        if (!schemas[row.table_schema]) schemas[row.table_schema] = [];
        schemas[row.table_schema].push(row.table_name);
    }

    for (const [schema, tables] of Object.entries(schemas)) {
        console.log(`Schema: ${schema}`);
        for (const table of tables) {
            console.log(`  - ${table}`);
        }
    }

    await client.end();
}

main().catch(console.error);
