const request = require('supertest');
const express = require('express');
const app = express();
const LoginAttempt = require('../models/loginAttemptModel');

require('dotenv').config({
  path: '.env.development',
});

const ddosRoute = require('../routes/ddosRoute');
app.use('/api', ddosRoute);

describe('DDoS Protection Tests', () => {
  beforeEach(async () => {
    await LoginAttempt.deleteMany({});
  });

  describe('Rate Limiting', () => {
    it('should allow requests when under the limit', async () => {
      const response = await request(app)
        .get('/api/ddos-check');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('not blocked');
    });

    it('should block IP after too many failed attempts', async () => {
      // Create a login attempt record with high count
      await LoginAttempt.create({
        identifier: '::ffff:127.0.0.1', // Local test IP
        attempts: 10,
        timeoutUntil: new Date(Date.now() + 60000) // 1 minute from now
      });

      const response = await request(app)
        .get('/api/ddos-check');

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('temporarily blocked');
    });

    it('should reset block after timeout period', async () => {
      // Create an expired timeout
      await LoginAttempt.create({
        identifier: '::ffff:127.0.0.1',
        attempts: 0,
        timeoutUntil: new Date(Date.now() - 1000) // 1 second ago
      });

      const response = await request(app)
        .get('/api/ddos-check');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should limit when attempts are high but no timeout set", async () => {
      // Create a login attempt record with 10+ attempts but no timeout
      await LoginAttempt.create({
        identifier: "::ffff:127.0.0.1",
        attempts: 10,
      });

      const response = await request(app).get("/api/ddos-check");

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Too many requests");
      expect(response.body.count).toBe(10);
    });

    it('should handle server errors', async () => {
        // Mock LoginAttempt.findOne to throw an error
        const originalFindOne = LoginAttempt.findOne;
        LoginAttempt.findOne = jest.fn().mockImplementation(() => {
          throw new Error('Database error');
        });
      
        const response = await request(app)
          .get('/api/ddos-check');
      
        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Server error');
      
        // Restore the original method
        LoginAttempt.findOne = originalFindOne;
      });
  });

  describe('Login Attempt Tracking', () => {
    it('should track failed login attempts', async () => {
      const identifier = 'test@example.com';
      
      // Simulate multiple failed attempts
      await LoginAttempt.create({
        identifier,
        attempts: 4,
        lastAttempt: new Date()
      });

      const loginAttempt = await LoginAttempt.findOne({ identifier });
      expect(loginAttempt.attempts).toBe(4);
    });

    it('should increase blocked count after timeout', async () => {
      const identifier = 'test@example.com';
      
      await LoginAttempt.create({
        identifier,
        attempts: 5,
        blockedCount: 1,
        timeoutUntil: new Date(Date.now() - 1000)
      });

      // Simulate more failed attempts
      const updatedAttempt = await LoginAttempt.findOneAndUpdate(
        { identifier },
        { 
          attempts: 5,
          timeoutUntil: new Date(Date.now() + 60000),
          blockedCount: 2
        },
        { new: true }
      );

      expect(updatedAttempt.blockedCount).toBe(2);
    });
  });
});
