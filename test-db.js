require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const db = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    const timeResult = await db.query('SELECT NOW() as current_time');
    console.log('✅ Database connected at:', timeResult.rows[0].current_time);
    
    // Check if leave_requests table exists
    const tableExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'leave_requests'
      )
    `);
    
    console.log('✅ leave_requests table exists:', tableExists.rows[0].exists);
    
    if (tableExists.rows[0].exists) {
      // Get table structure
      const tableStructure = await db.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'leave_requests'
        ORDER BY ordinal_position
      `);
      
      console.log('✅ Table structure:');
      tableStructure.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
      
      // Get sample data
      const sampleData = await db.query(`
        SELECT * FROM leave_requests 
        ORDER BY created_at DESC 
        LIMIT 3
      `);
      
      console.log('✅ Sample data count:', sampleData.rows.length);
      if (sampleData.rows.length > 0) {
        console.log('Sample record keys:', Object.keys(sampleData.rows[0]));
      }
    }
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await db.end();
  }
}

testDatabase();
