const request = require('supertest');
const express = require('express');
const User = require('../models/userModel');
const app = express();
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const jwt = require('jsonwebtoken');
const { generateTestToken } = require('./setup');

// Import and use relevant middleware
require('dotenv').config({
  path: '.env.development',
});

const userRoute = require('../routes/usersRoute');
app.use(express.json());
app.use('/api/users', userRoute);

describe('User Authentication & Management Tests', () => {
  let testUser;
  let adminUser;

  beforeEach(async () => {
    // Create a test user
    const hashedPassword = await bcrypt.hash('TestPass123', 10);
    testUser = await User.create({      
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phoneNumber: '1234567890',
      identificationType: 'NATIONAL ID',
      identificationNumber: 'TEST123',
      address: '123 Test St',
      password: hashedPassword,
      isVerified: true,
    });

    // Create an admin user
    adminUser = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      phoneNumber: '0987654321',
      identificationType: 'NATIONAL ID',
      identificationNumber: 'ADMIN123',
      address: '456 Admin St',
      password: hashedPassword,
      isAdmin: true,
      isVerified: true,
    });
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  describe('Registration', () => {
    it('should register a new user successfully', async () => {
      const newUser = {
        firstName: 'New',
        lastName: 'User',
        email: 'new@example.com',
        phoneNumber: '5555555555',
        identificationType: 'PASSPORT',
        identificationNumber: 'NEW123',
        address: '789 New St',
        password: 'NewPass123',
        confirmPassword: 'NewPass123',
      };

      const response = await request(app)
        .post('/api/users/register')
        .send(newUser);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User created successfully');
    });

    it('should reject registration with existing email', async () => {
      const duplicateUser = {
        firstName: 'Duplicate',
        lastName: 'User',
        email: 'test@example.com', // Same as testUser
        phoneNumber: '5555555555',
        identificationType: 'PASSPORT',
        identificationNumber: 'DUP123',
        address: '789 Dup St',
        password: 'DupPass123',
        confirmPassword: 'DupPass123',
      };      const response = await request(app)
        .post('/api/users/register')
        .send(duplicateUser);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User already exists');
    });

    it('should reject registration with invalid email format', async () => {
      const invalidEmailUser = {
        firstName: 'Invalid',
        lastName: 'Email',
        email: 'not-an-email',
        phoneNumber: '5555555555',
        identificationType: 'PASSPORT',
        identificationNumber: 'INV123',
        address: '123 Invalid St',
        password: 'Pass123456',
        confirmPassword: 'Pass123456'
      };

      const response = await request(app)
        .post('/api/users/register')
        .send(invalidEmailUser);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toBe('Invalid email format');
    });

    it('should reject registration with password mismatch', async () => {
      const mismatchPasswordUser = {
        firstName: 'Password',
        lastName: 'Mismatch',
        email: 'mismatch@example.com',
        phoneNumber: '5555555555',
        identificationType: 'PASSPORT',
        identificationNumber: 'MIS123',
        address: '123 Mismatch St',
        password: 'Pass123456',
        confirmPassword: 'DifferentPass123'
      };

      const response = await request(app)
        .post('/api/users/register')
        .send(mismatchPasswordUser);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toBe('Password and Confirm Password do not match');
    });

    it('should reject registration with invalid phone number', async () => {
      const invalidPhoneUser = {
        firstName: 'Invalid',
        lastName: 'Phone',
        email: 'phone@example.com',
        phoneNumber: '123', // Too short
        identificationType: 'PASSPORT',
        identificationNumber: 'PHN123',
        address: '123 Phone St',
        password: 'Pass123456',
        confirmPassword: 'Pass123456'
      };

      const response = await request(app)
        .post('/api/users/register')
        .send(invalidPhoneUser);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toBe('Phone number must be 10-15 digits');
    });

    it('should reject registration with invalid identification type', async () => {
      const invalidIdTypeUser = {
        firstName: 'Invalid',
        lastName: 'IdType',
        email: 'idtype@example.com',
        phoneNumber: '5555555555',
        identificationType: 'INVALID_TYPE',
        identificationNumber: 'IDT123',
        address: '123 IdType St',
        password: 'Pass123456',
        confirmPassword: 'Pass123456'
      };

      const response = await request(app)
        .post('/api/users/register')
        .send(invalidIdTypeUser);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toBe('Invalid identification type');
    });
  });

  describe('Login', () => {
    it('should login successfully with correct credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'TestPass123',
      };

      const response = await request(app)
        .post('/api/users/login')
        .send(credentials);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined(); // JWT token
    });

    it('should reject login with incorrect password', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'WrongPass123',
      };

      const response = await request(app)
        .post('/api/users/login')
        .send(credentials);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject login for unverified users', async () => {
      // Create an unverified user
      const unverifiedUser = await User.create({
        firstName: 'Unverified',
        lastName: 'User',
        email: 'unverified@example.com',
        phoneNumber: '1111111111',
        identificationType: 'NATIONAL ID',
        identificationNumber: 'UNVERIFIED123',
        address: '123 Unverified St',
        password: await bcrypt.hash('TestPass123', 10),
        isVerified: false
      });

      const credentials = {
        email: 'unverified@example.com',
        password: 'TestPass123',
      };

      const response = await request(app)
        .post('/api/users/login')
        .send(credentials);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User is not verified or has been suspended.');
    });
  });

  describe('Two Factor Authentication', () => {
    it('should enable 2FA for a user', async () => {
      const token = generateTestToken(testUser._id);

      const response = await request(app)
        .post('/api/users/enable-2fa')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: testUser._id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.otpauthUrl).toBeDefined();
    });

    it('should verify 2FA token correctly', async () => {
      const token = generateTestToken(testUser._id);
      
      // First enable 2FA
      await request(app)
        .post('/api/users/enable-2fa')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: testUser._id });

      // Get the updated user with 2FA secret
      const updatedUser = await User.findById(testUser._id);
        // Generate a valid TOTP token using the secret
      const validToken = speakeasy.totp({
        secret: updatedUser.twoFactorSecret,
        encoding: 'base32',
        step: 30,  // 30 second window
        time: Math.floor(Date.now() / 1000) // Current time
      });

      const response = await request(app)
        .post('/api/users/verify-2fa')
        .send({
          userId: testUser._id,
          token: validToken
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid 2FA tokens', async () => {
      const token = generateTestToken(testUser._id);
      
      // First enable 2FA
      await request(app)
        .post('/api/users/enable-2fa')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: testUser._id });

      const verifyResponse = await request(app)
        .post('/api/users/verify-2fa')
        .send({
          userId: testUser._id,
          token: '000000' // Invalid token
        });

      expect(verifyResponse.status).toBe(400);
      expect(verifyResponse.body.success).toBe(false);
      expect(verifyResponse.body.message).toBe('Invalid 2FA token');
    });

    it('should reject 2FA verification for user without 2FA enabled', async () => {
      const verifyResponse = await request(app)
        .post('/api/users/verify-2fa')
        .send({
          userId: testUser._id,
          token: '123456'
        });

      expect(verifyResponse.status).toBe(400);
      expect(verifyResponse.body.success).toBe(false);
      expect(verifyResponse.body.message).toBe('Two-factor authentication is not enabled for this user');
    });

    it('should not allow enabling 2FA twice', async () => {
      const token = generateTestToken(testUser._id);
      
      // Enable 2FA first time
      const firstEnableResponse = await request(app)
        .post('/api/users/enable-2fa')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: testUser._id });

      // Try to enable 2FA again
      const secondEnableResponse = await request(app)
        .post('/api/users/enable-2fa')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: testUser._id });

      expect(secondEnableResponse.status).toBe(400);
      expect(secondEnableResponse.body.success).toBe(false);
      expect(secondEnableResponse.body.message).toBe('Two-factor authentication is already enabled for this user');
    });

    it('should reject 2FA tokens with invalid format', async () => {
      const token = generateTestToken(testUser._id);
      
      // First enable 2FA
      await request(app)
        .post('/api/users/enable-2fa')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: testUser._id });

      const invalidFormatResponse = await request(app)
        .post('/api/users/verify-2fa')
        .send({
          userId: testUser._id,
          token: 'not-a-number' // Invalid token format
        });

      expect(invalidFormatResponse.status).toBe(400);
      expect(invalidFormatResponse.body.success).toBe(false);
      expect(invalidFormatResponse.body.message).toBe('Invalid 2FA token');
    });
  });

  describe('User Management (Admin)', () => {    
    it('should allow admin to get all users', async () => {
      const token = generateTestToken(adminUser._id, true);

      const response = await request(app)
        .get('/api/users/get-all-users')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // Check that both test users are in the response
      const users = response.body.data;
      expect(users.length).toBeGreaterThanOrEqual(2); // Should at least have our test user and admin user
      
      // Find our test users in the response
      const foundTestUser = users.find(u => u.email === testUser.email);
      const foundAdminUser = users.find(u => u.email === adminUser.email);
      
      // Verify test user properties
      expect(foundTestUser).toBeTruthy();
      expect(foundTestUser.firstName).toBe('Test');
      expect(foundTestUser.lastName).toBe('User');
      expect(foundTestUser.phoneNumber).toBe('1234567890');
      expect(foundTestUser.identificationType).toBe('NATIONAL ID');
      expect(foundTestUser.identificationNumber).toBe('TEST123');
      expect(foundTestUser.address).toBe('123 Test St');
      expect(foundTestUser.isAdmin).toBe(false);
      
      // Verify admin user properties
      expect(foundAdminUser).toBeTruthy();
      expect(foundAdminUser.firstName).toBe('Admin');
      expect(foundAdminUser.lastName).toBe('User');
      expect(foundAdminUser.phoneNumber).toBe('0987654321');
      expect(foundAdminUser.identificationType).toBe('NATIONAL ID');
      expect(foundAdminUser.identificationNumber).toBe('ADMIN123');
      expect(foundAdminUser.address).toBe('456 Admin St');
      expect(foundAdminUser.isAdmin).toBe(true);
      expect(foundAdminUser.isVerified).toBe(true);
    });    it('should allow admin to verify and unverify a user', async () => {
      const token = generateTestToken(adminUser._id, true);

      // First verify the user
      const verifyResponse = await request(app)
        .post('/api/users/update-user-verified-status')
        .set('Authorization', `Bearer ${token}`)
        .send({
          selectedUser: testUser._id,
          isVerified: true
        });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.message).toBe('User verified status updated successfully');

      // Check that the user is actually verified in the database
      let updatedUser = await User.findById(testUser._id);
      expect(updatedUser.isVerified).toBe(true);

      // Now unverify the user
      const unverifyResponse = await request(app)
        .post('/api/users/update-user-verified-status')
        .set('Authorization', `Bearer ${token}`)
        .send({
          selectedUser: testUser._id,
          isVerified: false
        });

      expect(unverifyResponse.status).toBe(200);
      expect(unverifyResponse.body.success).toBe(true);
      expect(unverifyResponse.body.message).toBe('User verified status updated successfully');

      // Check that the user is actually unverified in the database
      updatedUser = await User.findById(testUser._id);
      expect(updatedUser.isVerified).toBe(false);
    });

    it('should allow admin to delete a user', async () => {
      const token = generateTestToken(adminUser._id, true);

      const response = await request(app)
        .delete(`/api/users/delete-user/${testUser._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const deletedUser = await User.findById(testUser._id);
      expect(deletedUser).toBeNull();
    });

    it('should deny access to non-admin users', async () => {
      // Generate token for non-admin test user
      const token = generateTestToken(testUser._id, false);

      const response = await request(app)
        .get('/api/users/get-all-users')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should handle verification of non-existent user', async () => {
      const token = generateTestToken(adminUser._id, true);
      const fakeUserId = '507f1f77bcf86cd799439011'; // Valid MongoDB ObjectId that doesn't exist

      const response = await request(app)
        .post('/api/users/update-user-verified-status')
        .set('Authorization', `Bearer ${token}`)
        .send({
          selectedUser: fakeUserId,
          isVerified: true
        });      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle deletion of non-existent user', async () => {
      const token = generateTestToken(adminUser._id, true);
      const fakeUserId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .delete(`/api/users/delete-user/${fakeUserId}`)
        .set('Authorization', `Bearer ${token}`);      
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found');
    });
  });

  describe('Session Management', () => {
    it('should handle token refresh correctly', async () => {
      const agent = request(app);
      
      // First login to get the initial tokens
      await agent
        .post('/api/users/login')
        .send({
          email: 'test@example.com',
          password: 'TestPass123'
        });

      // Try to refresh the token
      const refreshResponse = await agent
        .post('/api/users/refresh-token');      
      
      expect(refreshResponse.status).toBe(403);
      expect(refreshResponse.body.success).toBe(false);
      expect(refreshResponse.body.message).toBe('Invalid or expired session.');
    });

    it('should reject refresh without valid token', async () => {
      const response = await request(app)
        .post('/api/users/refresh-token');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired session.');
    });
  });

  describe('Logout', () => {
    it('should clear the refresh token cookie on logout', async () => {
      const agent = request(app);
      
      // First login to get the cookie set
      const loginResponse = await agent
        .post('/api/users/login')
        .send({
          email: 'test@example.com',
          password: 'TestPass123'
        });
      
      expect(loginResponse.status).toBe(200);
      
      // Now logout
      const logoutResponse = await agent
        .post('/api/users/logout');
      
      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.success).toBe(true);
      expect(logoutResponse.body.message).toBe('Logged out successfully');
      
      // Try to refresh token to verify cookie was cleared
      const refreshResponse = await agent
        .post('/api/users/refresh-token');
      
      expect(refreshResponse.status).toBe(403);
    });
  });
  
  describe('Request Delete', () => {
    it('should update user delete request status', async () => {
      const token = generateTestToken(testUser._id);
      
      const response = await request(app)
        .post('/api/users/request-delete')
        .set('Authorization', `Bearer ${token}`)
        .send({
          _id: testUser._id,
          requestDelete: true
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User delete status updated successfully');
      
      // Verify the change in database
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.requestDelete).toBe(true);
    });
    
    it('should handle request delete with invalid user ID', async () => {
      const token = generateTestToken(testUser._id);
      const fakeUserId = '507f1f77bcf86cd799439011';
      
      const response = await request(app)
        .post('/api/users/request-delete')
        .set('Authorization', `Bearer ${token}`)
        .send({
          _id: fakeUserId,
          requestDelete: true
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('Check 2FA', () => {
    it('should correctly report 2FA not being enabled for a user', async () => {
      const response = await request(app)
        .post('/api/users/check-2fa')
        .send({ userId: testUser._id });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.isEnabled).toBe(false);
    });
    
    it('should correctly report 2FA being enabled for a user', async () => {
      // First enable 2FA
      const token = generateTestToken(testUser._id);
      await request(app)
        .post('/api/users/enable-2fa')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: testUser._id });
      
      // Now check if 2FA is enabled
      const response = await request(app)
        .post('/api/users/check-2fa')
        .send({ userId: testUser._id });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(true);
      expect(response.body.isEnabled).toBe(true);
    });
    
    it('should handle non-existent user when checking 2FA', async () => {
      const fakeUserId = '507f1f77bcf86cd799439011';
      
      const response = await request(app)
        .post('/api/users/check-2fa')
        .send({ userId: fakeUserId });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.isEnabled).toBe(false);
    });
  });
  
  describe('Disable 2FA', () => {
    it('should disable 2FA for a user', async () => {
      const token = generateTestToken(testUser._id);
      
      // First enable 2FA
      await request(app)
        .post('/api/users/enable-2fa')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: testUser._id });
      
      // Now disable 2FA
      const disableResponse = await request(app)
        .post('/api/users/disable-2fa')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: testUser._id });
      
      expect(disableResponse.status).toBe(200);
      expect(disableResponse.body.success).toBe(true);
      expect(disableResponse.body.message).toBe('Two-factor authentication disabled successfully');
      
      // Verify 2FA is disabled in database
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.twoFactorEnabled).toBe(false);
      expect(updatedUser.twoFactorSecret).toBeNull();
    });
    
    it('should reject disabling 2FA if not enabled', async () => {
      const token = generateTestToken(testUser._id);
      
      const response = await request(app)
        .post('/api/users/disable-2fa')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: testUser._id });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Two-factor authentication is not enabled for this user');
    });
    
    it('should handle non-existent user when disabling 2FA', async () => {
      const token = generateTestToken(adminUser._id, true);
      const fakeUserId = '507f1f77bcf86cd799439011';
      
      const response = await request(app)
        .post('/api/users/disable-2fa')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: fakeUserId });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('Additional Authentication Scenarios', () => {
    it('should reject requests without authentication token', async () => {
      const response = await request(app)
        .get('/api/users/get-all-users');
        
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
    
    it('should reject requests with invalid authentication token', async () => {
      const response = await request(app)
        .get('/api/users/get-all-users')
        .set('Authorization', 'Bearer invalid_token');
        
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
    
    it('should handle expired tokens', async () => {
      // Generate an expired token
      const expiredToken = jwt.sign(
        { userId: testUser._id, isAdmin: false },
        process.env.jwt_secret,
        { expiresIn: '0s' }
      );
      
      // Wait a moment to ensure token expiration
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = await request(app)
        .post('/api/users/get-user-info')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ userId: testUser._id });
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('Additional Registration Validation Tests', () => {
    it('should reject registration with invalid firstName format', async () => {
      const invalidUser = {
        firstName: '123456', // Numbers instead of letters
        lastName: 'User',
        email: 'invalid@example.com',
        phoneNumber: '5555555555',
        identificationType: 'PASSPORT',
        identificationNumber: 'INV123',
        address: '123 Invalid St',
        password: 'Pass123456',
        confirmPassword: 'Pass123456'
      };
  
      const response = await request(app)
        .post('/api/users/register')
        .send(invalidUser);
  
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors[0].msg).toBe('First name must be 1-50 letters only');
    });
    
    it('should reject registration with invalid lastName format', async () => {
      const invalidUser = {
        firstName: 'Valid',
        lastName: '123', // Numbers instead of letters
        email: 'invalid@example.com',
        phoneNumber: '5555555555',
        identificationType: 'PASSPORT',
        identificationNumber: 'INV123',
        address: '123 Invalid St',
        password: 'Pass123456',
        confirmPassword: 'Pass123456'
      };
  
      const response = await request(app)
        .post('/api/users/register')
        .send(invalidUser);
  
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors[0].msg).toBe('Last name must be 1-50 letters only');
    });
    
    it('should reject registration with invalid address', async () => {
      const invalidUser = {
        firstName: 'Valid',
        lastName: 'User',
        email: 'invalid@example.com',
        phoneNumber: '5555555555',
        identificationType: 'PASSPORT',
        identificationNumber: 'INV123',
        address: '<script>alert("XSS")</script>', // XSS attempt
        password: 'Pass123456',
        confirmPassword: 'Pass123456'
      };
  
      const response = await request(app)
        .post('/api/users/register')
        .send(invalidUser);
  
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors[0].msg).toBe('Address must be 1-100 characters long');
    });
    
    it('should reject registration with invalid identification number', async () => {
      const invalidUser = {
        firstName: 'Valid',
        lastName: 'User',
        email: 'invalid@example.com',
        phoneNumber: '5555555555',
        identificationType: 'PASSPORT',
        identificationNumber: 'Invalid-ID-!@#$%^', // Special characters
        address: '123 Valid St',
        password: 'Pass123456',
        confirmPassword: 'Pass123456'
      };
  
      const response = await request(app)
        .post('/api/users/register')
        .send(invalidUser);
  
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors[0].msg).toBe('Identification number must be 1-20 alphanumeric characters');
    });
    
    it('should reject registration with password that doesn\'t meet requirements', async () => {
      const invalidUser = {
        firstName: 'Valid',
        lastName: 'User',
        email: 'invalid@example.com',
        phoneNumber: '5555555555',
        identificationType: 'PASSPORT',
        identificationNumber: 'VALID123',
        address: '123 Valid St',
        password: 'password', // No numbers
        confirmPassword: 'password'
      };
  
      const response = await request(app)
        .post('/api/users/register')
        .send(invalidUser);
  
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors[0].msg).toBe('Password must be at least 8 characters long and include letters and numbers');
    });
  });
  
  describe('Additional Login Tests', () => {
    it('should reject login with missing fields', async () => {
      // Missing password
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: 'test@example.com'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  
    it('should handle server errors during login', async () => {
      // Mock User.findOne to throw an error
      const originalFindOne = User.findOne;
      User.findOne = jest.fn().mockImplementation(() => {
        throw new Error('Database connection error');
      });
      
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: 'test@example.com',
          password: 'TestPass123'
        });
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      
      // Restore the original method
      User.findOne = originalFindOne;
    });
  });
  
  describe('Get User Info', () => {
    it('should fetch user info successfully', async () => {
      const token = generateTestToken(testUser._id);
      
      const response = await request(app)
        .post('/api/users/get-user-info')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: testUser._id });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data._id.toString()).toBe(testUser._id.toString());
      expect(response.body.data.firstName).toBe('Test');
      expect(response.body.data.email).toBe('test@example.com');
      // Password should be excluded
      expect(response.body.data.password).toBeUndefined();
    });
    
    it('should handle non-existent user when fetching info', async () => {
      const fakeUserId = '507f1f77bcf86cd799439011';
      const token = generateTestToken(fakeUserId);
      
      const response = await request(app)
        .post('/api/users/get-user-info')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: fakeUserId });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User deleted or not found');
    });
  });
  
  describe('Enable 2FA Edge Cases', () => {
    it('should handle user not found when enabling 2FA', async () => {
      const fakeUserId = '507f1f77bcf86cd799439011';
      const token = generateTestToken(fakeUserId, true);
      
      const response = await request(app)
        .post('/api/users/enable-2fa')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: fakeUserId });
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found');
    });
    
    it('should handle server errors when enabling 2FA', async () => {
      const token = generateTestToken(testUser._id);
      
      // Mock User.findById to throw an error
      const originalFindById = User.findById;
      User.findById = jest.fn().mockImplementation(() => {
        throw new Error('Database connection error');
      });
      
      const response = await request(app)
        .post('/api/users/enable-2fa')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: testUser._id });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      
      // Restore the original method
      User.findById = originalFindById;
    });
  });
});
