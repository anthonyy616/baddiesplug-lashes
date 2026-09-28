import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function main() {
  const mig = await sql`
    SELECT * FROM drizzle.__drizzle_migrations LIMIT 10`;
  console.log(JSON.stringify(mig, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
}

main()
  .then(() => sql.end())
  .catch(async (err) => {
    console.error('Failed:', err.message);
    await sql.end();
    process.exit(1);
  });
