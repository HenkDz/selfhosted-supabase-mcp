const url = 'https://api.belajarcarabelajar.com/rest/v1/';
const key = 'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpc3MiOiAic3VwYWJhc2UiLCAiaWF0IjogMTc0MzQ4MDAwMCwgImV4cCI6IDE5MDEyNDY0MDB9.kXx8fSjH6eCH57CYEw_jQT73wy2U2CDzQKlUxKSbjBg';

async function main() {
    try {
        const res = await fetch(url, {
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Accept-Profile': 'public'
            }
        });
        const data = await res.json();
        if (data && data.definitions) {
            console.log('Schema: public (Accessible via REST API)');
            const tables = Object.keys(data.definitions);
            for (const table of tables) {
                console.log(`  - ${table}`);
            }
        } else {
            console.log('Failed to parse OpenAPI definitions', data);
        }
    } catch (e) {
        console.error(e);
    }
}
main();
