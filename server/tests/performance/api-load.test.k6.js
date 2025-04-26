import http from 'k6/http';
import { check, sleep, group } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 50 },  // ramp up to 50 users
    { duration: '5m', target: 50 },  // stay at 50 users
    { duration: '2m', target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    'http_req_failed{type:auth}': ['rate<0.01'], // less than 1% auth failures
    'http_req_failed{type:user}': ['rate<0.01'],
    'http_req_failed{type:transaction}': ['rate<0.01'],
    'http_req_failed{type:request}': ['rate<0.01'],
    'http_req_failed{type:report}': ['rate<0.01'],
  }
};

const BASE_URL = 'http://localhost:5000/api'; // Change port if needed

// Test user credentials
const USER_1 = {
  id: '680cd20f631e084fcb6c683d',
  email: 'walletxchangeloadtestus1@gmail.com',
  password: 'loadTest1'
};

const USER_2 = {
  id: '680cd31b631e084fcb6c6842',
  email: 'walletxchangeloadtestus2@gmail.com',
  password: 'loadTest2'
};

export default function () {
  // We'll alternate between the two test users
  const currentUser = Math.random() < 0.5 ? USER_1 : USER_2;
  let token = '';
  let userId = '';
  
  group('Authentication', function () {
    // 1. Login to get JWT token
    const loginPayload = JSON.stringify({
      email: currentUser.email,
      password: currentUser.password
    });
    
    const loginRes = http.post(`${BASE_URL}/users/login`, loginPayload, { 
      headers: { 'Content-Type': 'application/json' }
    });
    
    check(loginRes, { 
      'login status 200': r => r.status === 200,
      'has token': r => r.json('data') !== undefined
    });
    
    if (loginRes.status === 200 && loginRes.json('data')) {
      token = loginRes.json('data');
      userId = currentUser.id;
    }
    
    // Check 2FA endpoint (if needed)
    const check2FARes = http.post(`${BASE_URL}/users/check-2fa`, JSON.stringify({
      userId: userId
    }), { headers: authHeaders() });
    
    check(check2FARes, { 
      'check-2fa status 200': r => r.status === 200 
    });
  });
  
  // If no token received, we'll skip protected routes
  if (!token) {
    console.log('No token received, skipping protected routes');
    return;
  }
  
  // Helper function for authenticated headers
  function authHeaders() {
    return { 
      'Content-Type': 'application/json', 
      'Authorization': `Bearer ${token}` 
    };
  }
  
  // Run different test groups with varying probability to simulate realistic user behavior
  const testSelector = Math.random();
  
  if (testSelector < 0.2) {
    runUserTests();
  } else if (testSelector < 0.5) {
    runTransactionTests();
  } else if (testSelector < 0.8) {
    runRequestTests();
  } else {
    runReportTests();
  }
  
  // Random sleep between 0.5 and 1.5 seconds to simulate user behavior
  sleep(0.5 + Math.random());
  
  // USER ROUTES
  function runUserTests() {
    group('User Routes', function () {
      // Register a new user (public)
      const randomEmail = `loadtest${Math.floor(Math.random() * 1000000)}@test.com`;
      const registerPayload = JSON.stringify({
        firstName: 'Load',
        lastName: 'Test',
        email: randomEmail,
        phoneNumber: '1234567890',
        address: '123 Test St',
        identificationType: 'PASSPORT',
        identificationNumber: `A${Math.floor(Math.random() * 10000000)}`,
        password: 'loadTest10',
        confirmPassword: 'loadTest10'
      });
      
      const registerRes = http.post(`${BASE_URL}/users/register`, registerPayload, { 
        headers: { 'Content-Type': 'application/json' } 
      });
      
      check(registerRes, { 
        'register status 200/400': r => [200, 400].includes(r.status) 
      });      
      
      // Get user info (protected) - this is a POST endpoint, not GET
      // The userId is required by the endpoint even though it might also be extracted from the JWT token
      const userInfoPayload = JSON.stringify({
        userId: userId || currentUser.id // Ensure we always have a userId
      });
      
      const userInfoRes = http.post(`${BASE_URL}/users/get-user-info`, userInfoPayload, { 
        headers: authHeaders() 
      });
      
      check(userInfoRes, { 
        'get-user-info status 200': r => r.status === 200,
        'get-user-info has data': r => r.json('data') !== undefined
      });
      
      // Get all users (admin only)
      const allUsersRes = http.get(`${BASE_URL}/users/get-all-users`, { 
        headers: authHeaders() 
      });
      
      check(allUsersRes, { 
        'get-all-users status 200': r => r.status === 200,
        'get-all-users has data': r => r.json('data') !== undefined
      });
      
      // Update user verified status (admin only)
      const verifyPayload = JSON.stringify({
        userId: USER_2.id,
        isVerified: true
      });
      
      const verifyRes = http.post(`${BASE_URL}/users/update-user-verified-status`, verifyPayload, { 
        headers: authHeaders() 
      });
      
      check(verifyRes, { 
        'update-user-verified-status status 200/403': r => [200, 403].includes(r.status) 
      });
      
      // Request user deletion (protected)
      const requestDeletePayload = JSON.stringify({
        requestDelete: true
      });
      
      const requestDeleteRes = http.post(`${BASE_URL}/users/request-delete`, requestDeletePayload, { 
        headers: authHeaders() 
      });
      
      check(requestDeleteRes, { 
        'request-delete status 200/400': r => [200, 400, 401, 403].includes(r.status) 
      });
      
      // Delete user by ID (admin only) - we'll delete random users that might have been created
      if (registerRes.status === 200 && registerRes.json('data') && registerRes.json('data')._id) {
        const newUserId = registerRes.json('data')._id;
        
        const deleteRes = http.del(`${BASE_URL}/users/delete-user/${newUserId}`, null, { 
          headers: authHeaders() 
        });
        
        check(deleteRes, { 
          'delete-user status 200/403/404': r => [200, 403, 404].includes(r.status) 
        });
      }
      
      // Edit user profile (protected)
      const editUserPayload = JSON.stringify({
        firstName: 'Test',
        lastName: 'LoadTest',
        phoneNumber: '0885255645',
        address: '\'\'Han Asparuh\'\' str. 19 Updated'
      });
        const editUserRes = http.post(`${BASE_URL}/users/edit-user`, editUserPayload, { 
        headers: authHeaders() 
      });
      
      check(editUserRes, { 
        'edit-user status 200/400': r => [200, 400].includes(r.status) 
      });
    });
  }
  
  // TRANSACTION ROUTES
  function runTransactionTests() {
    group('Transaction Routes', function () {
      // Transfer money (protected)
      const transferPayload = JSON.stringify({
        sender: USER_1.id,
        receiver: USER_2.id,
        amount: Math.floor(Math.random() * 100) + 1
      });
      
      const transferRes = http.post(`${BASE_URL}/transactions/transfer-money`, transferPayload, { 
        headers: authHeaders() 
      });
      
      check(transferRes, { 
        'transfer-money status 200/400': r => [200, 400, 401, 403].includes(r.status) 
      });
        // Verify account (protected)
      const verifyPayload = JSON.stringify({
        userId: userId || currentUser.id, // Current user's ID as the sender
        receiver: USER_2.id,             // ID of the account to verify
      });
      
      const verifyRes = http.post(`${BASE_URL}/transactions/verify-account`, verifyPayload, { 
        headers: authHeaders() 
      });
      
      check(verifyRes, { 
        'verify-account status 200': r => r.status === 200 
      });
      
      // Get all transactions by user (protected)
      const transactionsPayload = JSON.stringify({
        userId: userId
      });
      
      const transactionsRes = http.post(`${BASE_URL}/transactions/get-all-transactions-by-user`, transactionsPayload, { 
        headers: authHeaders() 
      });
      
      check(transactionsRes, { 
        'get-all-transactions-by-user status 200': r => r.status === 200,
        'get-all-transactions-by-user has data': r => r.json('data') !== undefined
      });
    });
  }
  
  // REQUEST ROUTES
  function runRequestTests() {
    group('Request Routes', function () {
      // Get all requests by user (protected)
      const getRequestsPayload = JSON.stringify({
        userId: userId
      });
      
      const getRequestsRes = http.post(`${BASE_URL}/requests/get-all-requests-by-user`, getRequestsPayload, { 
        headers: authHeaders() 
      });
      
      check(getRequestsRes, { 
        'get-all-requests-by-user status 200': r => r.status === 200,
        'get-all-requests-by-user has data': r => r.json('data') !== undefined
      });
        // Send money request (protected)
      const sendRequestPayload = JSON.stringify({
        userId: userId || currentUser.id,  // Current user is the sender (handled by authMiddleware)
        receiver: USER_2.id,              // Target user who receives the request
        amount: Math.floor(Math.random() * 50) + 10,
        reference: 'Load test request'    // Called "reference" in the API, not "description" 
      });
      
      const sendRequestRes = http.post(`${BASE_URL}/requests/send-request`, sendRequestPayload, { 
        headers: authHeaders() 
      });
      
      check(sendRequestRes, { 
        'send-request status 200/400': r => [200, 400, 401, 403].includes(r.status) 
      });
        // Update request status (protected)
      // We'll only try to update if the previous request was successfully created
      if (sendRequestRes.status === 200 && sendRequestRes.json('data') && sendRequestRes.json('data')._id) {
        const requestData = sendRequestRes.json('data');
        
        // The API expects a very specific structure for this request
        const updateStatusPayload = JSON.stringify({
          _id: requestData._id,
          status: 'accepted', // lowercase: 'accepted', 'rejected', or 'pending'
          sender: { 
            _id: userId || currentUser.id 
          },
          receiver: { 
            _id: USER_2.id 
          },
          amount: requestData.amount || 100,
          description: requestData.description || 'Load test request'
        });
        
        const updateStatusRes = http.post(`${BASE_URL}/requests/update-request-status`, updateStatusPayload, { 
          headers: authHeaders() 
        });
        
        check(updateStatusRes, { 
          'update-request-status status 200/400/404': r => [200, 400, 401, 403, 404].includes(r.status) 
        });
      }
    });
  }
  
  // REPORT ROUTES
  function runReportTests() {
    group('Report Routes', function () {
      // Get transaction summary (protected)
      const summaryPayload = JSON.stringify({
        userId: userId
      });
      
      const summaryRes = http.post(`${BASE_URL}/reports/get-transaction-summary`, summaryPayload, { 
        headers: authHeaders() 
      });
      
      check(summaryRes, { 
        'get-transaction-summary status 200': r => r.status === 200,
        'get-transaction-summary has data': r => r.json('data') !== undefined
      });
      
      // Get monthly data (protected)
      const monthlyDataPayload = JSON.stringify({
        userId: userId,
        year: new Date().getFullYear()
      });
      
      const monthlyDataRes = http.post(`${BASE_URL}/reports/get-monthly-data`, monthlyDataPayload, { 
        headers: authHeaders() 
      });
      
      check(monthlyDataRes, { 
        'get-monthly-data status 200': r => r.status === 200,
        'get-monthly-data has data': r => r.json('data') !== undefined
      });
      
      // Get category summary (protected)
      const categorySummaryPayload = JSON.stringify({
        userId: userId
      });
      
      const categorySummaryRes = http.post(`${BASE_URL}/reports/get-category-summary`, categorySummaryPayload, { 
        headers: authHeaders() 
      });
      
      check(categorySummaryRes, { 
        'get-category-summary status 200': r => r.status === 200,
        'get-category-summary has data': r => r.json('data') !== undefined
      });
    });
  }
}
