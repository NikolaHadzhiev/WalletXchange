// filepath: c:\Users\Nikih\Desktop\Университет 2023\Семестър 6\Съвременни бази от данни\WalletXchange\server\tests\additional-transactions.test.js
const request = require('supertest');
const express = require('express');
const User = require('../models/userModel');
const Transaction = require('../models/transactionModel');
const DepositCode = require('../models/depositCodeModel');
const DeletedUser = require('../models/deletedUserModel');
const app = express();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { generateTestToken } = require('./setup');
const stripe = require('stripe');

// Import and use relevant middleware
require('dotenv').config({
  path: '.env.development',
});

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue(true)
  })
}));

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({ 
        status: 'succeeded',
        id: 'pi_test123'
      })
    }
  }));
});

const transactionRoute = require('../routes/transactionsRoute');
app.use(express.json());
app.use('/api/transactions', transactionRoute);

describe('Additional Transaction Tests', () => {
  let senderUser;
  let receiverUser;
  let senderToken;
  let invalidUserId;

  beforeEach(async () => {
    const hashedPassword = await bcrypt.hash('TestPass123', 10);
    senderUser = await User.create({
      firstName: 'Additional',
      lastName: 'Sender',
      email: 'addsender@example.com',
      phoneNumber: '1234567890',
      identificationType: 'NATIONAL ID',
      identificationNumber: 'ADDSENDER123',
      address: '123 Additional St',
      password: hashedPassword,
      balance: 1000,
      isVerified: true
    });

    receiverUser = await User.create({
      firstName: 'Additional',
      lastName: 'Receiver',
      email: 'addreceiver@example.com',
      phoneNumber: '0987654321',
      identificationType: 'NATIONAL ID',
      identificationNumber: 'ADDRECEIVER123',
      address: '456 Additional St',
      password: hashedPassword,
      isVerified: true
    });

    senderToken = generateTestToken(senderUser._id);
    invalidUserId = new mongoose.Types.ObjectId();
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Transaction.deleteMany({});
    await DepositCode.deleteMany({});
    await DeletedUser.deleteMany({});
  });

  describe('Transfer Money Edge Cases', () => {
    it('should handle transfer with non-existent receiver ID', async () => {
      const transferData = {
        sender: senderUser._id,
        receiver: invalidUserId,
        amount: 100,
        reference: 'Test transfer to non-existent user'
      };

      const response = await request(app)
        .post('/api/transactions/transfer-money')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(transferData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
    });

    it('should handle database errors during balance update', async () => {
      // Mock User.findByIdAndUpdate to throw an error
      const originalFindByIdAndUpdate = User.findByIdAndUpdate;
      User.findByIdAndUpdate = jest.fn().mockRejectedValue(new Error('Database error during update'));

      const transferData = {
        sender: senderUser._id,
        receiver: receiverUser._id,
        amount: 100,
        reference: 'Test transfer with DB error'
      };

      const response = await request(app)
        .post('/api/transactions/transfer-money')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(transferData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);

      // Restore the original method
      User.findByIdAndUpdate = originalFindByIdAndUpdate;
    });

    it('should handle database errors during transaction creation', async () => {
      // Mock Transaction constructor to throw an error
      const originalTransaction = Transaction;
      global.Transaction = jest.fn().mockImplementation(() => {
        throw new Error('Transaction creation error');
      });

      const transferData = {
        sender: senderUser._id,
        receiver: receiverUser._id,
        amount: 100,
        reference: 'Test transfer with Transaction error'
      };

      const response = await request(app)
        .post('/api/transactions/transfer-money')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(transferData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);

      // Restore the original constructor
      global.Transaction = originalTransaction;
    });

    it('should handle malicious references in transfers', async () => {
      const transferData = {
        sender: senderUser._id,
        receiver: receiverUser._id,
        amount: 100,
        reference: '<script>alert("XSS");</script>' // Potentially malicious script
      };

      const response = await request(app)
        .post('/api/transactions/transfer-money')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(transferData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Check that the reference was sanitized
      const transaction = await Transaction.findOne({ 
        sender: senderUser._id, 
        receiver: receiverUser._id 
      });
      expect(transaction.reference).not.toContain('<script>');
      expect(transaction.reference).toBe('alert("XSS");');
    });
  });

  describe('Deposit Flow Edge Cases', () => {
    it('should handle email failures during deposit verification code sending', async () => {
      // Mock nodemailer to simulate email failure
      require('nodemailer').createTransport.mockReturnValueOnce({
        sendMail: jest.fn().mockRejectedValue(new Error('Email sending failed'))
      });

      const depositData = {
        userId: senderUser._id,
        amount: 100,
        token: {
          id: 'test_token_id',
          email: 'test@example.com'
        }
      };

      const response = await request(app)
        .post('/api/transactions/deposit-money')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(depositData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
    });

    it('should handle expired verification codes', async () => {
      // Create an expired verification code
      await DepositCode.create({
        userId: senderUser._id,
        email: 'expired@example.com',
        stripeId: 'expired_token',
        veritificationCode: '123456',
        expiresAt: new Date(Date.now() - 1000) // Already expired
      });

      const verifyData = {
        userId: senderUser._id,
        verificationCode: '123456',
        amount: 100
      };

      const response = await request(app)
        .post('/api/transactions/verify-deposit')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(verifyData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired verification code');
    });

    it('should handle Stripe payment failures', async () => {
      // Create a valid verification code
      await DepositCode.create({
        userId: senderUser._id,
        email: 'stripe@example.com',
        stripeId: 'failing_token',
        veritificationCode: '789012',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // Valid for 10 minutes
      });

      // Mock Stripe to simulate payment failure
      stripe.mockImplementationOnce(() => ({
        paymentIntents: {
          create: jest.fn().mockImplementation(() => {
            throw { 
              type: 'StripeCardError',
              message: 'Your card was declined'
            };
          })
        }
      }));

      const verifyData = {
        userId: senderUser._id,
        verificationCode: '789012',
        amount: 100
      };

      const response = await request(app)
        .post('/api/transactions/verify-deposit')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(verifyData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBe('Your card was declined');
    });

    it('should handle various Stripe error types', async () => {
      // Create a valid verification code
      await DepositCode.create({
        userId: senderUser._id,
        email: 'stripeerror@example.com',
        stripeId: 'error_token',
        veritificationCode: '345678',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // Valid for 10 minutes
      });

      // Test each type of Stripe error
      const stripeErrors = [
        { type: 'StripeInvalidRequestError', message: 'Invalid payment information', expectedMessage: 'Invalid payment information.' },
        { type: 'StripeRateLimitError', message: 'Too many attempts', expectedMessage: 'Too many payment attempts. Please try again later.' },
        { type: 'StripeAPIError', message: 'API error', expectedMessage: 'Payment system error. Please try again later.' },
        { type: 'OtherError', message: 'Unknown error', expectedMessage: 'Payment failed.' }
      ];

      for (const errorType of stripeErrors) {
        // Mock Stripe to throw specific error
        stripe.mockImplementationOnce(() => ({
          paymentIntents: {
            create: jest.fn().mockImplementation(() => {
              throw { 
                type: errorType.type,
                message: errorType.message
              };
            })
          }
        }));

        const verifyData = {
          userId: senderUser._id,
          verificationCode: '345678',
          amount: 100
        };

        const response = await request(app)
          .post('/api/transactions/verify-deposit')
          .set('Authorization', `Bearer ${senderToken}`)
          .send(verifyData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(false);
        expect(response.body.data).toBe(errorType.expectedMessage);
      }
    });
  });

  describe('Get Transactions with Deleted Users', () => {
    it('should handle transactions with deleted sender', async () => {
      // Create a transaction
      const transaction = await Transaction.create({
        sender: senderUser._id,
        receiver: receiverUser._id,
        amount: 150,
        reference: 'Test transaction with deleted sender',
        status: 'success'
      });

      // Create a DeletedUser record for the sender
      await DeletedUser.create({
        deleteId: senderUser._id,
        firstName: 'Deleted',
        lastName: 'Sender',
        transactions: [{ _id: transaction._id }]
      });

      // Update transaction to have null sender
      await Transaction.findByIdAndUpdate(transaction._id, { sender: null });

      // Get transactions as receiver
      const receiverToken = generateTestToken(receiverUser._id);
      const response = await request(app)
        .post('/api/transactions/get-all-transactions-by-user')
        .set('Authorization', `Bearer ${receiverToken}`)
        .send({ userId: receiverUser._id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // The transaction should have the deleted user's info restored
      const foundTransaction = response.body.data.find(t => t._id === transaction._id.toString());
      expect(foundTransaction).toBeDefined();
      expect(foundTransaction.sender).toBeDefined();
      expect(foundTransaction.sender.firstName).toBe('Deleted');
      expect(foundTransaction.sender.lastName).toBe('Sender');
    });

    it('should handle transactions with both sender and receiver deleted', async () => {
      // Create a transaction
      const transaction = await Transaction.create({
        sender: senderUser._id,
        receiver: receiverUser._id,
        amount: 150,
        reference: 'Test transaction with both users deleted',
        status: 'success'
      });

      // Create DeletedUser records for both users
      await DeletedUser.create({
        deleteId: senderUser._id,
        firstName: 'Deleted',
        lastName: 'Sender',
        transactions: [{ _id: transaction._id }]
      });

      await DeletedUser.create({
        deleteId: receiverUser._id,
        firstName: 'Deleted',
        lastName: 'Receiver',
        transactions: [{ _id: transaction._id }]
      });

      // Update transaction to have null sender and receiver
      await Transaction.findByIdAndUpdate(transaction._id, { 
        sender: null,
        receiver: null 
      });

      // Create a new user to access transactions
      const newUser = await User.create({
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@example.com',
        phoneNumber: '1122334455',
        identificationType: 'NATIONAL ID',
        identificationNumber: 'NEW123',
        address: '789 New St',
        password: await bcrypt.hash('TestPass123', 10),
        isVerified: true,
        isAdmin: true
      });

      // Using admin user to get all transactions
      const adminToken = generateTestToken(newUser._id, true);
      const response = await request(app)
        .post('/api/transactions/get-all-transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // The transaction should exist but may have incomplete sender/receiver info
      const foundTransaction = response.body.data.find(t => t._id === transaction._id.toString());
      expect(foundTransaction).toBeDefined();
    });
  });

  describe('Verify Account Additional Tests', () => {
    it('should sanitize inputs in verify account endpoint', async () => {
      // Test with unsanitized inputs
      const verifyData = {
        userId: `${senderUser._id}<script>alert("XSS")</script>`,
        receiver: `${receiverUser._id}<script>alert("XSS")</script>`
      };

      const response = await request(app)
        .post('/api/transactions/verify-account')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(verifyData);

      // The endpoint should sanitize these inputs before processing
      expect(response.status).toBe(200);
      
      // Should either succeed with sanitized input or fail gracefully with error message
      if (response.body.success === true) {
        // If it succeeds, the data should be sanitized
        expect(response.body.data._id.toString()).toBe(receiverUser._id.toString());
      } else {
        // If it fails, it should have a sensible error message
        expect(response.body.message).toBeDefined();
      }
    });
  });

  describe('Transaction Notification Emails', () => {
    it('should handle missing email when sending transaction notifications', async () => {
      // Create a user without email
      const userWithoutEmail = await User.create({
        firstName: 'No',
        lastName: 'Email',
        phoneNumber: '1122334455',
        identificationType: 'NATIONAL ID',
        identificationNumber: 'NOEMAIL123',
        address: '789 No Email St',
        password: await bcrypt.hash('TestPass123', 10),
        balance: 500,
        isVerified: true
      });

      const transferData = {
        sender: senderUser._id,
        receiver: userWithoutEmail._id,
        amount: 100,
        reference: 'Test transfer to user without email'
      };

      const response = await request(app)
        .post('/api/transactions/transfer-money')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(transferData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Only one email should be sent (to sender)
      const nodemailer = require('nodemailer');
      const mockTransporter = nodemailer.createTransport();
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
    });
  });
});
