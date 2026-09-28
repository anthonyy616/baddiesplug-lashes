import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function main() {
  const schemas = await sql`SELECT schema_name FROM information_schema.schemata`;
  console.log('schemas:', schemas.map((s) => s.schema_name).join(', '));

  for (const schema of ['drizzle', 'public', 'neon']) {
    try {
      const t = await sql`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = ${schema} AND table_name LIKE '%migration%'`;
      if (t.length > 0) console.log(`${schema} migration tables:`, t.map((r) => r.table_name).join(', '));
    } catch {
      /* schema missing */
    }
  }
}

main()
  .then(() => sql.end())
  .catch(async (err) => {
    console.error('Failed:', err.message);
    await sql.end();
    process.exit(1);
  });
