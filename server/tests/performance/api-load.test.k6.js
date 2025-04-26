import http from 'k6/http';
import { check, sleep, group } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 50 },  // ramp up to 50 users
    { duration: '5m', target: 50 },  // stay at 50 users
    { duration: '2m', target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<4000'],  // (currently 4s due to free-tier MongoDB cluster limitations; in production with a paid cluster, expected to be well below 1s)
    'http_req_failed{type:auth}': ['rate<0.01'], // less than 1% auth failures
    'http_req_failed{type:user}': ['rate<0.01'],
    'http_req_failed{type:transaction}': ['rate<0.01'],
    'http_req_failed{type:request}': ['rate<0.01'],
    'http_req_failed{type:report}': ['rate<0.01'],
    'http_req_failed': ['rate<0.01'], // less than 1% overall failures
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
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'POST /users/login', type: 'auth' }
    });
      check(loginRes, { 
      'login status 200': r => r.status === 200,
      'has token': r => r.json('data') !== undefined
    });
    
    // Log slow responses (>2s)
    if (loginRes.timings.duration > 2000) {
      console.warn(`🚨 Slow endpoint: ${loginRes.request.url} took ${loginRes.timings.duration} ms`);
    }

    // Log failed responses
    if (loginRes.status !== 200) {
      console.error(`❌ Failed request: ${loginRes.request.url} Status: ${loginRes.status}`);
    }
    
    if (loginRes.status === 200 && loginRes.json('data')) {
      token = loginRes.json('data');
      userId = currentUser.id;
    }
    
    // Check 2FA endpoint (if needed)
    const check2FARes = http.post(`${BASE_URL}/users/check-2fa`, JSON.stringify({
      userId: userId
    }), { 
      headers: authHeaders(),
      tags: { name: 'POST /users/check-2fa', type: 'auth' }
    });
      check(check2FARes, { 
      'check-2fa status 200': r => r.status === 200 
    });
    
    // Log slow responses (>2s)
    if (check2FARes.timings.duration > 2000) {
      console.warn(`🚨 Slow endpoint: ${check2FARes.request.url} took ${check2FARes.timings.duration} ms`);
    }

    // Log failed responses
    if (check2FARes.status !== 200) {
      console.error(`❌ Failed request: ${check2FARes.request.url} Status: ${check2FARes.status}`);
    }
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
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'POST /users/register', type: 'user' }
      });
        check(registerRes, { 
        'register status 200/400': r => [200, 400].includes(r.status) 
      });
      
      // Log slow responses (>2s)
      if (registerRes.timings.duration > 2000) {
        console.warn(`🚨 Slow endpoint: ${registerRes.request.url} took ${registerRes.timings.duration} ms`);
      }

      // Log failed responses
      if (registerRes.status !== 200) {
        console.error(`❌ Failed request: ${registerRes.request.url} Status: ${registerRes.status}`);
      }
      
      // Get user info (protected) - this is a POST endpoint, not GET
      // The userId is required by the endpoint even though it might also be extracted from the JWT token
      const userInfoPayload = JSON.stringify({
        userId: userId || currentUser.id // Ensure we always have a userId
      });
      
      const userInfoRes = http.post(`${BASE_URL}/users/get-user-info`, userInfoPayload, { 
        headers: authHeaders(),
        tags: { name: 'POST /users/get-user-info', type: 'user' }
      });
        check(userInfoRes, { 
        'get-user-info status 200': r => r.status === 200,
        'get-user-info has data': r => r.json('data') !== undefined
      });
      
      // Log slow responses (>2s)
      if (userInfoRes.timings.duration > 2000) {
        console.warn(`🚨 Slow endpoint: ${userInfoRes.request.url} took ${userInfoRes.timings.duration} ms`);
      }

      // Log failed responses
      if (userInfoRes.status !== 200) {
        console.error(`❌ Failed request: ${userInfoRes.request.url} Status: ${userInfoRes.status}`);
      }
      
      // Get all users (admin only)
      const allUsersRes = http.get(`${BASE_URL}/users/get-all-users`, { 
        headers: authHeaders(),
        tags: { name: 'GET /users/get-all-users', type: 'user' }
      });
        check(allUsersRes, { 
        'get-all-users status 200': r => r.status === 200,
        'get-all-users has data': r => r.json('data') !== undefined
      });
      
      // Log slow responses (>2s)
      if (allUsersRes.timings.duration > 2000) {
        console.warn(`🚨 Slow endpoint: ${allUsersRes.request.url} took ${allUsersRes.timings.duration} ms`);
      }

      // Log failed responses
      if (allUsersRes.status !== 200) {
        console.error(`❌ Failed request: ${allUsersRes.request.url} Status: ${allUsersRes.status}`);
      }
      
      // Update user verified status (admin only)
      const verifyPayload = JSON.stringify({
        userId: USER_2.id,
        isVerified: true
      });
      
      const verifyRes = http.post(`${BASE_URL}/users/update-user-verified-status`, verifyPayload, { 
        headers: authHeaders(),
        tags: { name: 'POST /users/update-user-verified-status', type: 'user' }
      });
        check(verifyRes, { 
        'update-user-verified-status status 200/403': r => [200, 403].includes(r.status) 
      });
      
      // Log slow responses (>2s)
      if (verifyRes.timings.duration > 2000) {
        console.warn(`🚨 Slow endpoint: ${verifyRes.request.url} took ${verifyRes.timings.duration} ms`);
      }

      // Log failed responses
      if (verifyRes.status !== 200) {
        console.error(`❌ Failed request: ${verifyRes.request.url} Status: ${verifyRes.status}`);
      }
      
      // Request user deletion (protected)
      const requestDeletePayload = JSON.stringify({
        requestDelete: true
      });
      
      const requestDeleteRes = http.post(`${BASE_URL}/users/request-delete`, requestDeletePayload, { 
        headers: authHeaders(),
        tags: { name: 'POST /users/request-delete', type: 'user' }
      });
        check(requestDeleteRes, { 
        'request-delete status 200/400': r => [200, 400, 401, 403].includes(r.status) 
      });
      
      // Log slow responses (>2s)
      if (requestDeleteRes.timings.duration > 2000) {
        console.warn(`🚨 Slow endpoint: ${requestDeleteRes.request.url} took ${requestDeleteRes.timings.duration} ms`);
      }

      // Log failed responses
      if (requestDeleteRes.status !== 200) {
        console.error(`❌ Failed request: ${requestDeleteRes.request.url} Status: ${requestDeleteRes.status}`);
      }
      
      // Delete user by ID (admin only) - we'll delete random users that might have been created
      if (registerRes.status === 200 && registerRes.json('data') && registerRes.json('data')._id) {
        const newUserId = registerRes.json('data')._id;
        
        const deleteRes = http.del(`${BASE_URL}/users/delete-user/${newUserId}`, null, { 
          headers: authHeaders(),
          tags: { name: 'DELETE /users/delete-user', type: 'user' }
        });
          check(deleteRes, { 
          'delete-user status 200/403/404': r => [200, 403, 404].includes(r.status) 
        });
        
        // Log slow responses (>2s)
        if (deleteRes.timings.duration > 2000) {
          console.warn(`🚨 Slow endpoint: ${deleteRes.request.url} took ${deleteRes.timings.duration} ms`);
        }

        // Log failed responses
        if (deleteRes.status !== 200) {
          console.error(`❌ Failed request: ${deleteRes.request.url} Status: ${deleteRes.status}`);
        }
      }
        // Edit user profile (protected)
      const editUserPayload = JSON.stringify({
        _id: userId || currentUser.id, // Add the user ID - this is required by the endpoint
        firstName: 'Test',
        lastName: 'LoadTest',
        phoneNumber: '0885255645',
        address: '\'\'Han Asparuh\'\' str. 19 Updated'
      });
      
      const editUserRes = http.post(`${BASE_URL}/users/edit-user`, editUserPayload, { 
        headers: authHeaders(),
        tags: { name: 'POST /users/edit-user', type: 'user' }
      });
        check(editUserRes, { 
        'edit-user status 200/400': r => [200, 400].includes(r.status) 
      });
      
      // Log slow responses (>2s)
      if (editUserRes.timings.duration > 2000) {
        console.warn(`🚨 Slow endpoint: ${editUserRes.request.url} took ${editUserRes.timings.duration} ms`);
      }

      // Log failed responses
      if (editUserRes.status !== 200) {
        console.error(`❌ Failed request: ${editUserRes.request.url} Status: ${editUserRes.status}`);
      }
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
        headers: authHeaders(),
        tags: { name: 'POST /transactions/transfer-money', type: 'transaction' }
      });
        check(transferRes, { 
        'transfer-money status 200/400': r => [200, 400, 401, 403].includes(r.status) 
      });
      
      // Log slow responses (>2s)
      if (transferRes.timings.duration > 2000) {
        console.warn(`🚨 Slow endpoint: ${transferRes.request.url} took ${transferRes.timings.duration} ms`);
      }

      // Log failed responses
      if (transferRes.status !== 200) {
        console.error(`❌ Failed request: ${transferRes.request.url} Status: ${transferRes.status}`);
      }
      
      // Verify account (protected)
      const verifyPayload = JSON.stringify({
        userId: userId || currentUser.id, // Current user's ID as the sender
        receiver: USER_2.id,             // ID of the account to verify
      });
      
      const verifyRes = http.post(`${BASE_URL}/transactions/verify-account`, verifyPayload, { 
        headers: authHeaders(),
        tags: { name: 'POST /transactions/verify-account', type: 'transaction' }
      });
        check(verifyRes, { 
        'verify-account status 200': r => r.status === 200 
      });
      
      // Log slow responses (>2s)
      if (verifyRes.timings.duration > 2000) {
        console.warn(`🚨 Slow endpoint: ${verifyRes.request.url} took ${verifyRes.timings.duration} ms`);
      }

      // Log failed responses
      if (verifyRes.status !== 200) {
        console.error(`❌ Failed request: ${verifyRes.request.url} Status: ${verifyRes.status}`);
      }
      
      // Get all transactions by user (protected)
      const transactionsPayload = JSON.stringify({
        userId: userId
      });
      
      const transactionsRes = http.post(`${BASE_URL}/transactions/get-all-transactions-by-user`, transactionsPayload, { 
        headers: authHeaders(),
        tags: { name: 'POST /transactions/get-all-transactions-by-user', type: 'transaction' }
      });
        check(transactionsRes, { 
        'get-all-transactions-by-user status 200': r => r.status === 200,
        'get-all-transactions-by-user has data': r => r.json('data') !== undefined
      });
      
      // Log slow responses (>2s)
      if (transactionsRes.timings.duration > 2000) {
        console.warn(`🚨 Slow endpoint: ${transactionsRes.request.url} took ${transactionsRes.timings.duration} ms`);
      }

      // Log failed responses
      if (transactionsRes.status !== 200) {
        console.error(`❌ Failed request: ${transactionsRes.request.url} Status: ${transactionsRes.status}`);
      }
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
        headers: authHeaders(),
        tags: { name: 'POST /requests/get-all-requests-by-user', type: 'request' }
      });
        check(getRequestsRes, { 
        'get-all-requests-by-user status 200': r => r.status === 200,
        'get-all-requests-by-user has data': r => r.json('data') !== undefined
      });
      
      // Log slow responses (>2s)
      if (getRequestsRes.timings.duration > 2000) {
        console.warn(`🚨 Slow endpoint: ${getRequestsRes.request.url} took ${getRequestsRes.timings.duration} ms`);
      }

      // Log failed responses
      if (getRequestsRes.status !== 200) {
        console.error(`❌ Failed request: ${getRequestsRes.request.url} Status: ${getRequestsRes.status}`);
      }
      
      // Send money request (protected)
      const sendRequestPayload = JSON.stringify({
        userId: userId || currentUser.id,  // Current user is the sender (handled by authMiddleware)
        receiver: USER_2.id,              // Target user who receives the request
        amount: Math.floor(Math.random() * 50) + 10,
        reference: 'Load test request'    // Called "reference" in the API, not "description" 
      });
      
      const sendRequestRes = http.post(`${BASE_URL}/requests/send-request`, sendRequestPayload, { 
        headers: authHeaders(),
        tags: { name: 'POST /requests/send-request', type: 'request' }
      });
        check(sendRequestRes, { 
        'send-request status 200/400': r => [200, 400, 401, 403].includes(r.status) 
      });
      
      // Log slow responses (>2s)
      if (sendRequestRes.timings.duration > 2000) {
        console.warn(`🚨 Slow endpoint: ${sendRequestRes.request.url} took ${sendRequestRes.timings.duration} ms`);
      }

      // Log failed responses
      if (sendRequestRes.status !== 200) {
        console.error(`❌ Failed request: ${sendRequestRes.request.url} Status: ${sendRequestRes.status}`);
      }
      
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
          headers: authHeaders(),
          tags: { name: 'POST /requests/update-request-status', type: 'request' }
        });
          check(updateStatusRes, { 
          'update-request-status status 200/400/404': r => [200, 400, 401, 403, 404].includes(r.status) 
        });
        
        // Log slow responses (>2s)
        if (updateStatusRes.timings.duration > 2000) {
          console.warn(`🚨 Slow endpoint: ${updateStatusRes.request.url} took ${updateStatusRes.timings.duration} ms`);
        }

        // Log failed responses
        if (updateStatusRes.status !== 200) {
          console.error(`❌ Failed request: ${updateStatusRes.request.url} Status: ${updateStatusRes.status}`);
        }
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
        headers: authHeaders(),
        tags: { name: 'POST /reports/get-transaction-summary', type: 'report' }
      });
        check(summaryRes, { 
        'get-transaction-summary status 200': r => r.status === 200,
        'get-transaction-summary has data': r => r.json('data') !== undefined
      });
      
      // Log slow responses (>2s)
      if (summaryRes.timings.duration > 2000) {
        console.warn(`🚨 Slow endpoint: ${summaryRes.request.url} took ${summaryRes.timings.duration} ms`);
      }

      // Log failed responses
      if (summaryRes.status !== 200) {
        console.error(`❌ Failed request: ${summaryRes.request.url} Status: ${summaryRes.status}`);
      }
      
      // Get monthly data (protected)
      const monthlyDataPayload = JSON.stringify({
        userId: userId,
        year: new Date().getFullYear()
      });
      
      const monthlyDataRes = http.post(`${BASE_URL}/reports/get-monthly-data`, monthlyDataPayload, { 
        headers: authHeaders(),
        tags: { name: 'POST /reports/get-monthly-data', type: 'report' }
      });
        check(monthlyDataRes, { 
        'get-monthly-data status 200': r => r.status === 200,
        'get-monthly-data has data': r => r.json('data') !== undefined
      });
      
      // Log slow responses (>2s)
      if (monthlyDataRes.timings.duration > 2000) {
        console.warn(`🚨 Slow endpoint: ${monthlyDataRes.request.url} took ${monthlyDataRes.timings.duration} ms`);
      }

      // Log failed responses
      if (monthlyDataRes.status !== 200) {
        console.error(`❌ Failed request: ${monthlyDataRes.request.url} Status: ${monthlyDataRes.status}`);
      }
      
      // Get category summary (protected)
      const categorySummaryPayload = JSON.stringify({
        userId: userId
      });
      
      const categorySummaryRes = http.post(`${BASE_URL}/reports/get-category-summary`, categorySummaryPayload, {
        headers: authHeaders(),
        tags: { name: 'POST /reports/get-category-summary', type: 'report' }
      });
        check(categorySummaryRes, { 
        'get-category-summary status 200': r => r.status === 200,
        'get-category-summary has data': r => r.json('data') !== undefined
      });
      
      // Log slow responses (>2s)
      if (categorySummaryRes.timings.duration > 2000) {
        console.warn(`🚨 Slow endpoint: ${categorySummaryRes.request.url} took ${categorySummaryRes.timings.duration} ms`);
      }

      // Log failed responses
      if (categorySummaryRes.status !== 200) {
        console.error(`❌ Failed request: ${categorySummaryRes.request.url} Status: ${categorySummaryRes.status}`);
      }
    });
  }
}
