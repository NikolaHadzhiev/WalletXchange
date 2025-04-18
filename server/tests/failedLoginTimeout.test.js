const request = require('supertest');
const express = require('express');
const app = express();
const LoginAttempt = require('../models/loginAttemptModel');
const { loginRateLimiter } = require('../middlewares/failedLoginTimeoutMiddleware');

require('dotenv').config({
  path: '.env.development',
});

// Add body-parser middleware
app.use(express.json());

// Middleware functions holder
let middlewareFunctions = {
  incrementAttempts: null,
  resetAttempts: null
};

// Mock route for testing
app.use(loginRateLimiter);
app.use((req, res, next) => {
  // Capture middleware functions
  if (req.incrementAttempts) middlewareFunctions.incrementAttempts = req.incrementAttempts;
  if (req.resetAttempts) middlewareFunctions.resetAttempts = req.resetAttempts;
  next();
});

app.post('/api/test-login', (req, res) => {
  res.status(200).json({ success: true });
});

describe('Failed Login Timeout Middleware Tests', () => {  
  beforeEach(async () => {
    await LoginAttempt.deleteMany({});
  });

  it('should use IP address when email is not provided', async () => {
    const response = await request(app)
      .post('/api/test-login')
      .send({}); // Send empty body

    // The middleware should have created a login attempt with the IP
    const loginAttempt = await LoginAttempt.findOne({ identifier: '::ffff:127.0.0.1' }); // Default IP for local requests
    expect(loginAttempt).toBeTruthy();
    expect(loginAttempt.identifier).toBe('::ffff:127.0.0.1');
  });

  it('should allow requests when no previous attempts exist', async () => {
    const response = await request(app)
      .post('/api/test-login')
      .send({ email: 'test@example.com' });

    expect(response.status).toBe(200);
  });

  it('should allow requests when attempts exist but under limit', async () => {
    await LoginAttempt.create({
      identifier: 'test@example.com',
      attempts: 3,
      lastAttempt: new Date()
    });

    const response = await request(app)
      .post('/api/test-login')
      .send({ email: 'test@example.com' });

    expect(response.status).toBe(200);
  });

  it('should block requests when max attempts reached', async () => {
    await LoginAttempt.create({
      identifier: 'test@example.com',
      attempts: 5,
      lastAttempt: new Date(),
      timeoutUntil: new Date(Date.now() + 60000) // 1 minute from now
    });

    const response = await request(app)
      .post('/api/test-login')
      .send({ email: 'test@example.com' });

    expect(response.status).toBe(429);
    expect(response.body.success).toBe(false);
    expect(response.body.remainingTime).toBeDefined();
  });

  it('should allow requests after timeout period', async () => {
    await LoginAttempt.create({
      identifier: 'test@example.com',
      attempts: 5,
      lastAttempt: new Date(Date.now() - 120000), // 2 minutes ago
      timeoutUntil: new Date(Date.now() - 60000) // Expired 1 minute ago
    });

    const response = await request(app)
      .post('/api/test-login')
      .send({ email: 'test@example.com' });

    expect(response.status).toBe(200);
  });

  it('should handle incrementAttempts correctly', async () => {
    const response = await request(app)
      .post('/api/test-login')
      .send({ email: 'test@example.com' });    // Simulate incrementing attempts
    await middlewareFunctions.incrementAttempts();

    const loginAttempt = await LoginAttempt.findOne({ identifier: 'test@example.com' });
    expect(loginAttempt.attempts).toBe(1);
  });

  it('should handle resetAttempts correctly', async () => {
    // Create initial attempt
    await LoginAttempt.create({
      identifier: 'test@example.com',
      attempts: 3,
      lastAttempt: new Date()
    });

    const response = await request(app)
      .post('/api/test-login')
      .send({ email: 'test@example.com' });    // Reset attempts
    await middlewareFunctions.resetAttempts();

    const loginAttempt = await LoginAttempt.findOne({ identifier: 'test@example.com' });
    expect(loginAttempt).toBeNull();
  });

  it('should handle database error in LoginAttempt.create', async () => {
    // Mock LoginAttempt.create to throw error
    const originalCreate = LoginAttempt.create;
    LoginAttempt.create = jest.fn().mockRejectedValue(new Error('Database error'));

    const response = await request(app)
      .post('/api/test-login')
      .send({ email: 'test@example.com' });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Internal server error.');

    // Restore original function
    LoginAttempt.create = originalCreate;
  });

  it('should handle database error in loginAttempt.save', async () => {
    // Create attempt with mocked save function
    const loginAttempt = await LoginAttempt.create({
      identifier: 'test@example.com',
      attempts: 0,
      lastAttempt: new Date()
    });

    const originalSave = loginAttempt.save;
    loginAttempt.save = jest.fn().mockRejectedValue(new Error('Save error'));

    // Mock findOne to return our modified document
    const originalFindOne = LoginAttempt.findOne;
    LoginAttempt.findOne = jest.fn().mockResolvedValue(loginAttempt);    const response = await request(app)
      .post('/api/test-login')
      .send({ email: 'test@example.com' });

    try {
      await middlewareFunctions.incrementAttempts();
    } catch (error) {
      expect(error.message).toBe('Save error');
    }

    // Verify error was handled
    expect(loginAttempt.save).toHaveBeenCalled();

    // Restore original functions
    LoginAttempt.findOne = originalFindOne;
    loginAttempt.save = originalSave;
  });

  it('should handle database error in resetAttempts', async () => {
    // Mock LoginAttempt.deleteOne to throw error
    const originalDeleteOne = LoginAttempt.deleteOne;
    LoginAttempt.deleteOne = jest.fn().mockRejectedValue(new Error('Delete error'));

    const response = await request(app)
      .post('/api/test-login')
      .send({ email: 'test@example.com' });    try {
      await middlewareFunctions.resetAttempts();
    } catch (error) {
      expect(error.message).toBe('Delete error');
    }

    // Restore original function
    LoginAttempt.deleteOne = originalDeleteOne;
  });

  it('should increment blockedCount when max attempts reached', async () => {
    await LoginAttempt.create({
      identifier: 'test@example.com',
      attempts: 4,
      blockedCount: 0,
      lastAttempt: new Date()
    });    
    
    // Get the login attempt before making changes
    let loginAttempt = await LoginAttempt.findOne({ identifier: 'test@example.com' });
    
    const response = await request(app)
      .post('/api/test-login')
      .send({ email: 'test@example.com' });
      
    // Mock the save function to succeed for this test
    const originalSave = loginAttempt.save;
    loginAttempt.save = jest.fn().mockResolvedValue(loginAttempt);
    
    await middlewareFunctions.incrementAttempts();

    const updatedLoginAttempt = await LoginAttempt.findOne({ identifier: 'test@example.com' });
    expect(updatedLoginAttempt.blockedCount).toBe(1);
    expect(updatedLoginAttempt.attempts).toBe(0); // Should reset after block

    // Restore original save function
    loginAttempt.save = originalSave;
  });
});
