require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

(async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const db = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Deleting ALL rows from leave_requests...');
    const res = await db.query('DELETE FROM leave_requests RETURNING id');
    console.log(`Deleted ${res.rowCount} leave request(s).`);
  } catch (err) {
    console.error('Error deleting leave requests:', err.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();

