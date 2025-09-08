require('dotenv').config({ path: '.env.local' });
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

// Create a test JWT token for admin user
const adminToken = jwt.sign(
  { 
    userId: '0a2b77ac-9883-4bfd-ab38-66f8aa836967', // Admin user ID from database
    email: 'admin@example.com' 
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('Generated admin token:', adminToken);

async function testApproveAPI() {
  try {
    console.log('Testing approve API endpoint...');
    
    const requestId = '90f039a2-1d75-48fa-be55-d8073f279acf'; // The pending request we created
    
    const response = await fetch('http://localhost:3000/api/leave-requests/approve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        requestId: requestId,
        adminNotes: 'Approved via API test'
      })
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Response body:', responseText);
    
    if (response.ok) {
      console.log('✅ API call successful!');
      try {
        const data = JSON.parse(responseText);
        console.log('Parsed response:', data);
      } catch (e) {
        console.log('Response is not JSON');
      }
    } else {
      console.log('❌ API call failed');
      try {
        const errorData = JSON.parse(responseText);
        console.log('Error details:', errorData);
      } catch (e) {
        console.log('Error response is not JSON');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Test if server is running first
async function testServer() {
  try {
    const response = await fetch('http://localhost:3000/api/test');
    console.log('Server test status:', response.status);
    const data = await response.json();
    console.log('Server test response:', data);
    
    if (response.ok) {
      console.log('✅ Server is running, testing approve API...');
      await testApproveAPI();
    } else {
      console.log('❌ Server test failed');
    }
  } catch (error) {
    console.error('❌ Server is not running:', error.message);
    console.log('Please start the development server with: npm run dev');
  }
}

testServer();
