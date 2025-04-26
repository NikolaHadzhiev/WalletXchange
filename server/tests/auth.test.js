const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { authenticationMiddleware, authorizationMiddleware } = require('../middlewares/authMiddleware');
const { generateTestToken } = require('./setup');

require('dotenv').config({
  path: '.env.development',
});

// Mock environment variables
process.env.jwt_secret = 'test-secret';

describe('Authentication Middleware Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Create test routes that use our middleware
    app.get('/test-auth', authenticationMiddleware, (req, res) => {
      res.status(200).send({ success: true, userId: req.body.userId });
    });
    
    app.get('/test-admin', authorizationMiddleware, (req, res) => {
      res.status(200).send({ success: true, message: 'Admin access granted' });
    });
  });

  describe('authenticationMiddleware', () => {
    it('should pass with valid token', async () => {
      const token = generateTestToken('user123');

      const response = await request(app)
        .get('/test-auth')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.userId).toBe('user123');
    });

    it('should fail with missing authorization header', async () => {
      const response = await request(app)
        .get('/test-auth');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Authorization header missing or malformed');
    });

    it('should fail with invalid token format', async () => {
      const response = await request(app)
        .get('/test-auth')
        .set('Authorization', 'InvalidToken');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Authorization header missing or malformed');
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/test-auth')
        .set('Authorization', 'Bearer invalidtoken');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('authorizationMiddleware', () => {
    it('should allow access with admin token', async () => {
      const adminToken = generateTestToken('admin123', true);

      const response = await request(app)
        .get('/test-admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject access with non-admin token', async () => {
      const userToken = generateTestToken('user123', false);

      const response = await request(app)
        .get('/test-admin')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Insufficient privileges');
    });

    // Testing line 28: No authorization header provided
    it('should reject when no authorization header is provided', async () => {
      const response = await request(app)
        .get('/test-admin');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('No authorization token provided');
      expect(response.body.success).toBe(false);
    });

    // Testing line 37: Malformed authorization header (no token after splitting)
    it('should reject when authorization header is malformed', async () => {
      const response = await request(app)
        .get('/test-admin')
        .set('Authorization', 'Bearer '); // Empty token

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Malformed authorization header');
      expect(response.body.success).toBe(false);
    });

    // Testing line 53: Error during token verification
    it('should handle error during token verification', async () => {
      // Mock jwt.verify to throw an error
      const originalVerify = jwt.verify;
      jwt.verify = jest.fn().mockImplementation(() => {
        throw new Error('Token verification failed');
      });

      const response = await request(app)
        .get('/test-admin')
        .set('Authorization', 'Bearer sometoken');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token verification failed');
      expect(response.body.success).toBe(false);

      // Restore original function
      jwt.verify = originalVerify;
    });
  });
});
