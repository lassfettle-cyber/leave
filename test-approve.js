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

async function testApprove() {
  try {
    console.log('Testing leave request approval...');
    
    // First, get a pending leave request
    const pendingRequests = await db.query(`
      SELECT * FROM leave_requests 
      WHERE status = 'pending' 
      LIMIT 1
    `);
    
    if (pendingRequests.rows.length === 0) {
      console.log('No pending requests found. Creating a test request...');
      
      // Get a user to create a test request
      const users = await db.query(`
        SELECT id FROM profiles 
        WHERE role = 'employee' 
        LIMIT 1
      `);
      
      if (users.rows.length === 0) {
        console.log('❌ No employee users found');
        return;
      }
      
      const userId = users.rows[0].id;
      
      // Create a test leave request
      const testRequest = await db.query(`
        INSERT INTO leave_requests (
          user_id, start_date, end_date, days, reason, status
        ) VALUES ($1, $2, $3, $4, $5, 'pending')
        RETURNING *
      `, [
        userId,
        '2025-09-15',
        '2025-09-16', 
        2,
        'Test leave request for approval testing'
      ]);
      
      console.log('✅ Created test request:', testRequest.rows[0].id);
      pendingRequests.rows = testRequest.rows;
    }
    
    const requestToApprove = pendingRequests.rows[0];
    console.log('📋 Request to approve:', requestToApprove.id);
    
    // Get an admin user to approve it
    const admins = await db.query(`
      SELECT id FROM profiles 
      WHERE role = 'admin' 
      LIMIT 1
    `);
    
    if (admins.rows.length === 0) {
      console.log('❌ No admin users found');
      return;
    }
    
    const adminId = admins.rows[0].id;
    console.log('👤 Admin approving:', adminId);
    
    // Test the approval update
    const updateResult = await db.query(`
      UPDATE leave_requests 
      SET status = 'approved', 
          approved_by = $1, 
          approved_at = NOW(),
          admin_notes = $2
      WHERE id = $3
      RETURNING *
    `, [adminId, 'Test approval via script', requestToApprove.id]);
    
    if (updateResult.rows.length > 0) {
      console.log('✅ Successfully approved request!');
      console.log('Updated record:', {
        id: updateResult.rows[0].id,
        status: updateResult.rows[0].status,
        approved_by: updateResult.rows[0].approved_by,
        approved_at: updateResult.rows[0].approved_at,
        admin_notes: updateResult.rows[0].admin_notes
      });
    } else {
      console.log('❌ No rows were updated');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await db.end();
  }
}

testApprove();
