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
    console.log('Adding position column to profiles table...');
    
    // Add position column if it doesn't exist
    await db.query(`
      ALTER TABLE profiles 
      ADD COLUMN IF NOT EXISTS position TEXT CHECK (position IN ('captain', 'first_officer'))
    `);
    console.log('✅ Position column added to profiles table');

    // Add position column to invites table if it doesn't exist
    await db.query(`
      ALTER TABLE invites 
      ADD COLUMN IF NOT EXISTS position TEXT CHECK (position IN ('captain', 'first_officer'))
    `);
    console.log('✅ Position column added to invites table');

    console.log('\n✅ Migration completed successfully!');
  } catch (err) {
    console.error('❌ Error during migration:', err.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();

