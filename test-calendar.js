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

async function testCalendarAPI() {
  try {
    console.log('Testing calendar API endpoint...');
    
    // Test with September 2025 date range
    const startDate = '2025-09-01';
    const endDate = '2025-09-30';
    
    const response = await fetch(`http://localhost:3000/api/calendar/leave-requests?startDate=${startDate}&endDate=${endDate}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    
    console.log('Response status:', response.status);
    
    const responseText = await response.text();
    console.log('Response body:', responseText);
    
    if (response.ok) {
      console.log('✅ Calendar API call successful!');
      try {
        const data = JSON.parse(responseText);
        console.log('Parsed response:', JSON.stringify(data, null, 2));
        
        // Check for Sunday entries
        const sundayEntries = data.leaveBlocks?.filter(block => {
          const date = new Date(block.date);
          return date.getDay() === 0; // Sunday
        });
        
        if (sundayEntries && sundayEntries.length > 0) {
          console.log('❌ Found Sunday entries:', sundayEntries);
        } else {
          console.log('✅ No Sunday entries found');
        }
        
        // Check for Saturday entries
        const saturdayEntries = data.leaveBlocks?.filter(block => {
          const date = new Date(block.date);
          return date.getDay() === 6; // Saturday
        });
        
        if (saturdayEntries && saturdayEntries.length > 0) {
          console.log('✅ Found Saturday entries:', saturdayEntries);
        } else {
          console.log('ℹ️ No Saturday entries found');
        }
        
      } catch (e) {
        console.log('Response is not JSON');
      }
    } else {
      console.log('❌ Calendar API call failed');
      try {
        const errorData = JSON.parse(responseText);
        console.log('Error details:', errorData);
      } catch (e) {
        console.log('Error response is not JSON');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
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
      console.log('✅ Server is running, testing calendar API...');
      await testCalendarAPI();
    } else {
      console.log('❌ Server test failed');
    }
  } catch (error) {
    console.error('❌ Server is not running:', error.message);
    console.log('Please start the development server with: npm run dev');
  }
}

testServer();
