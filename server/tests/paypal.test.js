// filepath: c:\Users\Nikih\Desktop\Университет 2023\Семестър 6\Съвременни бази от данни\WalletXchange\server\tests\paypal.test.js
const request = require('supertest');
const express = require('express');
const User = require('../models/userModel');
const Transaction = require('../models/transactionModel');
const DepositCode = require('../models/depositCodeModel');
const DeletedUser = require('../models/deletedUserModel');
const app = express();
const bcrypt = require('bcryptjs');
const { generateTestToken } = require('./setup');
const mongoose = require('mongoose');
const paypal = require('@paypal/checkout-server-sdk');

// Import and use relevant middleware
require('dotenv').config({
  path: '.env.development',
});

// Mock PayPal SDK
jest.mock('@paypal/checkout-server-sdk', () => {
  const mockOrder = {
    result: {
      id: 'test_order_id',
      status: 'CREATED',
      links: [
        {
          href: 'https://sandbox.paypal.com/checkout/approve',
          rel: 'approve'
        }
      ]
    }
  };
  
  return {
    core: {
      PayPalHttpClient: jest.fn().mockImplementation(() => ({
        execute: jest.fn().mockResolvedValue(mockOrder)
      })),
      SandboxEnvironment: jest.fn()
    },
    orders: {
      OrdersCreateRequest: jest.fn().mockImplementation(() => ({
        prefer: jest.fn(),
        requestBody: jest.fn()
      }))
    }
  };
});

// Mock Axios for PayPal API calls
jest.mock('axios', () => ({
  post: jest.fn().mockImplementation(() => Promise.resolve({
    data: { batch_header: { payout_batch_id: 'test_payout_id' } }
  })),
  get: jest.fn().mockImplementation(() => Promise.resolve({
    data: { batch_header: { batch_status: 'SUCCESS' } }
  }))
}));

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue(true)
  })
}));

const paypalRoute = require('../routes/paypalRoute');
app.use(express.json());
app.use('/api/paypal', paypalRoute);

describe('PayPal Transactions Tests', () => {
  let user;
  let token;
  let invalidId = new mongoose.Types.ObjectId();

  beforeEach(async () => {
    // Create a test user
    const hashedPassword = await bcrypt.hash('TestPass123', 10);
    user = await User.create({
      firstName: 'PayPal',
      lastName: 'Tester',
      email: 'paypal@example.com',
      phoneNumber: '1234567890',
      identificationType: 'NATIONAL ID',
      identificationNumber: 'PP123456',
      address: '123 PayPal St',
      password: hashedPassword,
      balance: 1000,
      isVerified: true
    });

    token = generateTestToken(user._id);
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Transaction.deleteMany({});
    await DepositCode.deleteMany({});
  });

  describe('Create PayPal Order', () => {
    it('should create a PayPal order successfully', async () => {
      const payload = {
        userId: user._id,
        amount: 100,
        returnUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel'
      };

      const response = await request(app)
        .post('/api/paypal/create-paypal-order')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.orderID).toBeDefined();
      expect(response.body.approvalUrl).toBeDefined();
    });

    it('should reject order creation with invalid amount', async () => {
      const payload = {
        userId: user._id,
        amount: -50,
        returnUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel'
      };

      const response = await request(app)
        .post('/api/paypal/create-paypal-order')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid amount');
    });

    it('should reject order creation with invalid user ID', async () => {
      const payload = {
        userId: 'invalid-id',
        amount: 100,
        returnUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel'
      };

      const response = await request(app)
        .post('/api/paypal/create-paypal-order')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid user ID');
    });

    it('should reject order creation with missing URLs', async () => {
      const payload = {
        userId: user._id,
        amount: 100
        // missing returnUrl and cancelUrl
      };

      const response = await request(app)
        .post('/api/paypal/create-paypal-order')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Missing return or cancel URL');
    });

    it('should handle PayPal API errors gracefully', async () => {
      // Mock a PayPal API error
      const originalExecute = paypal.core.PayPalHttpClient.prototype.execute;
      paypal.core.PayPalHttpClient.prototype.execute = jest.fn().mockRejectedValue(
        new Error('PayPal API Error')
      );

      const payload = {
        userId: user._id,
        amount: 100,
        returnUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel'
      };

      const response = await request(app)
        .post('/api/paypal/create-paypal-order')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Error initiating PayPal deposit');

      // Restore the original method
      paypal.core.PayPalHttpClient.prototype.execute = originalExecute;
    });
  });

  describe('Request Verification Code', () => {
    it('should send verification code successfully', async () => {
      const payload = {
        userId: user._id,
        email: 'paypal@example.com',
        orderID: 'test_order_id'
      };

      const response = await request(app)
        .post('/api/paypal/request-verification')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Check if a verification code was created
      const verificationCode = await DepositCode.findOne({
        userId: user._id,
        stripeId: 'test_order_id'
      });
      
      expect(verificationCode).toBeTruthy();
      expect(verificationCode.veritificationCode).toMatch(/^\d{6}$/); // Should be a 6-digit code
    });

    it('should reject request with missing email', async () => {
      const payload = {
        userId: user._id,
        orderID: 'test_order_id'
        // missing email
      };

      const response = await request(app)
        .post('/api/paypal/request-verification')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Missing email or order ID');
    });

    it('should reject request with missing order ID', async () => {
      const payload = {
        userId: user._id,
        email: 'paypal@example.com'
        // missing orderID
      };

      const response = await request(app)
        .post('/api/paypal/request-verification')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Missing email or order ID');
    });

    it('should handle database errors gracefully', async () => {
      // Mock DepositCode.create to throw an error
      const originalCreate = DepositCode.create;
      DepositCode.create = jest.fn().mockRejectedValue(new Error('Database error'));

      const payload = {
        userId: user._id,
        email: 'paypal@example.com',
        orderID: 'test_order_id'
      };

      const response = await request(app)
        .post('/api/paypal/request-verification')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);

      // Restore the original method
      DepositCode.create = originalCreate;
    });
  });

  describe('Verify PayPal Deposit', () => {
    beforeEach(async () => {
      // Create a verification code for testing
      await DepositCode.create({
        userId: user._id,
        email: 'paypal@example.com',
        stripeId: 'test_order_id',
        veritificationCode: '123456',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // Valid for 10 minutes
      });
    });

    it('should verify deposit successfully with valid code', async () => {
      const payload = {
        userId: user._id,
        verificationCode: '123456',
        orderId: 'test_order_id',
        amount: 100
      };

      const response = await request(app)
        .post('/api/paypal/verify-paypal')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Check if user balance was updated
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.balance).toBe(1100); // Original 1000 + 100
      
      // Check if a transaction was created
      const transaction = await Transaction.findOne({
        sender: user._id,
        receiver: user._id,
        amount: 100,
        type: 'Deposit'
      });
      
      expect(transaction).toBeTruthy();
      expect(transaction.status).toBe('success');
      
      // Check if verification code was deleted
      const verificationCode = await DepositCode.findOne({
        userId: user._id,
        stripeId: 'test_order_id'
      });
      
      expect(verificationCode).toBeFalsy();
    });

    it('should reject verification with invalid code', async () => {
      const payload = {
        userId: user._id,
        verificationCode: 'wrong',
        orderId: 'test_order_id',
        amount: 100
      };

      const response = await request(app)
        .post('/api/paypal/verify-paypal')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired verification code');
      
      // Check that user balance remains unchanged
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.balance).toBe(1000);
    });

    it('should reject verification with invalid amount', async () => {
      const payload = {
        userId: user._id,
        verificationCode: '123456',
        orderId: 'test_order_id',
        amount: -50
      };

      const response = await request(app)
        .post('/api/paypal/verify-paypal')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid amount');
    });

    it('should handle user not found error', async () => {
      const invalidToken = generateTestToken(invalidId);
      
      const payload = {
        userId: invalidId,
        verificationCode: '123456',
        orderId: 'test_order_id',
        amount: 100
      };

      const response = await request(app)
        .post('/api/paypal/verify-paypal')
        .set('Authorization', `Bearer ${invalidToken}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PayPal Withdrawal', () => {
    it('should initiate withdrawal and send verification code', async () => {
      const payload = {
        userId: user._id,
        email: 'paypal@example.com',
        amount: 100
      };

      const response = await request(app)
        .post('/api/paypal/withdraw-paypal')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Check if a verification code was created
      const verificationCode = await DepositCode.findOne({
        userId: user._id,
        email: 'paypal@example.com',
      });
      
      expect(verificationCode).toBeTruthy();
      expect(verificationCode.veritificationCode).toMatch(/^\d{6}$/);
    });

    it('should reject withdrawal with invalid amount', async () => {
      const payload = {
        userId: user._id,
        email: 'paypal@example.com',
        amount: -50
      };

      const response = await request(app)
        .post('/api/paypal/withdraw-paypal')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid amount');
    });

    it('should reject withdrawal with insufficient funds', async () => {
      const payload = {
        userId: user._id,
        email: 'paypal@example.com',
        amount: 2000 // More than the user's balance
      };

      const response = await request(app)
        .post('/api/paypal/withdraw-paypal')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Insufficient funds');
    });

    it('should reject withdrawal with missing email', async () => {
      const payload = {
        userId: user._id,
        amount: 100
        // missing email
      };

      const response = await request(app)
        .post('/api/paypal/withdraw-paypal')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Missing email');
    });

    it('should handle database errors gracefully', async () => {
      // Mock DepositCode.create to throw an error
      const originalCreate = DepositCode.create;
      DepositCode.create = jest.fn().mockRejectedValue(new Error('Database error'));

      const payload = {
        userId: user._id,
        email: 'paypal@example.com',
        amount: 100
      };

      const response = await request(app)
        .post('/api/paypal/withdraw-paypal')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);

      // Restore the original method
      DepositCode.create = originalCreate;
    });
  });

  describe('Verify PayPal Withdrawal', () => {
    beforeEach(async () => {
      // Create a verification code for testing
      await DepositCode.create({
        userId: user._id,
        email: 'paypal@example.com',
        stripeId: 'withdraw_test_id',
        veritificationCode: '654321',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // Valid for 10 minutes
      });
    });

    it('should verify withdrawal successfully with valid code', async () => {
      const payload = {
        userId: user._id,
        verificationCode: '654321',
        withdrawId: 'withdraw_test_id',
        amount: 100
      };

      const response = await request(app)
        .post('/api/paypal/verify-withdraw-paypal')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Check if user balance was updated
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.balance).toBe(900); // Original 1000 - 100
      
      // Check if a transaction was created
      const transaction = await Transaction.findOne({
        sender: user._id,
        receiver: user._id,
        amount: 100,
        type: 'Withdrawal'
      });
      
      expect(transaction).toBeTruthy();
      expect(transaction.status).toBe('success');
    });

    it('should reject withdrawal verification with invalid code', async () => {
      const payload = {
        userId: user._id,
        verificationCode: 'wrong',
        withdrawId: 'withdraw_test_id',
        amount: 100
      };

      const response = await request(app)
        .post('/api/paypal/verify-withdraw-paypal')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired verification code');
      
      // Check that user balance remains unchanged
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.balance).toBe(1000);
    });

    it('should reject withdrawal verification with invalid amount', async () => {
      const payload = {
        userId: user._id,
        verificationCode: '654321',
        withdrawId: 'withdraw_test_id',
        amount: -50
      };

      const response = await request(app)
        .post('/api/paypal/verify-withdraw-paypal')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid amount');
    });

    it('should reject withdrawal verification with insufficient funds', async () => {
      // Update user to have less balance
      await User.findByIdAndUpdate(user._id, { balance: 50 });
      
      const payload = {
        userId: user._id,
        verificationCode: '654321',
        withdrawId: 'withdraw_test_id',
        amount: 100
      };

      const response = await request(app)
        .post('/api/paypal/verify-withdraw-paypal')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Insufficient funds');
    });

    it('should handle database errors gracefully', async () => {
      // Mock User.findById to throw an error
      const originalFindById = User.findById;
      User.findById = jest.fn().mockRejectedValue(new Error('Database error'));

      const payload = {
        userId: user._id,
        verificationCode: '654321',
        withdrawId: 'withdraw_test_id',
        amount: 100
      };

      const response = await request(app)
        .post('/api/paypal/verify-withdraw-paypal')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);

      // Restore the original method
      User.findById = originalFindById;
    });
  });

  describe('Authentication and Edge Cases', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .post('/api/paypal/create-paypal-order')
        .send({});

      expect(response.status).toBe(401);
    });

    it('should reject requests with invalid authentication', async () => {
      const response = await request(app)
        .post('/api/paypal/create-paypal-order')
        .set('Authorization', 'Bearer invalid_token')
        .send({});

      expect(response.status).toBe(401);
    });

    it('should handle invalid route gracefully', async () => {
      const response = await request(app)
        .post('/api/paypal/non-existent-endpoint')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(404);
    });

    it('should handle invalid HTTP method gracefully', async () => {
      const response = await request(app)
        .put('/api/paypal/create-paypal-order')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(404);
    });
  });
});
