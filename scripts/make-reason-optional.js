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
    console.log('Making reason column nullable in leave_requests table...');
    
    // Alter the reason column to allow NULL values
    await db.query(`
      ALTER TABLE leave_requests 
      ALTER COLUMN reason DROP NOT NULL
    `);
    
    console.log('✅ Reason column is now nullable');
    console.log('\n✅ Migration completed successfully!');
  } catch (err) {
    console.error('❌ Error during migration:', err.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();

