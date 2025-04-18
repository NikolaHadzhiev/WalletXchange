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

// Import and use relevant middleware
require('dotenv').config({
  path: '.env.development',
});

const transactionRoute = require('../routes/transactionsRoute');
app.use(express.json());
app.use('/api/transactions', transactionRoute);

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue(true)
  })
}));

jest.mock('stripe', () => {
  const mockCharges = {
    create: jest.fn().mockResolvedValue({ status: 'succeeded' })
  };
  const mockCustomers = {
    create: jest.fn().mockResolvedValue({ id: 'cus_test123', email: 'test@example.com' })
  };
  
  return jest.fn().mockImplementation(() => ({
    charges: mockCharges,
    customers: mockCustomers
  }));
});

describe('Transaction Tests', () => {
  let senderUser;
  let receiverUser;
  let senderToken;
  let invalidUserId;

  beforeEach(async () => {
    // Create sender user
    const hashedPassword = await bcrypt.hash('TestPass123', 10);
    senderUser = await User.create({
      firstName: 'Sender',
      lastName: 'User',
      email: 'sender@example.com',
      phoneNumber: '1234567890',
      identificationType: 'NATIONAL ID',
      identificationNumber: 'SENDER123',
      address: '123 Sender St',
      password: hashedPassword,
      balance: 1000,
      isVerified: true
    });

    // Create receiver user
    receiverUser = await User.create({
      firstName: 'Receiver',
      lastName: 'User',
      email: 'receiver@example.com',
      phoneNumber: '0987654321',
      identificationType: 'NATIONAL ID',
      identificationNumber: 'RECEIVER123',
      address: '456 Receiver St',
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

  describe('Transfer Money', () => {
    it('should successfully transfer money between users', async () => {
      const transferAmount = 100;
      const transferData = {
        sender: senderUser._id,
        receiver: receiverUser._id,
        amount: transferAmount,
        reference: 'Test transfer'
      };

      const response = await request(app)
        .post('/api/transactions/transfer-money')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(transferData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify sender's balance was reduced
      const updatedSender = await User.findById(senderUser._id);
      expect(updatedSender.balance).toBe(900); // 1000 - 100

      // Verify receiver's balance was increased
      const updatedReceiver = await User.findById(receiverUser._id);
      expect(updatedReceiver.balance).toBe(100);
    });

    it('should fail transfer with insufficient funds', async () => {
      const transferAmount = 2000; // More than sender's balance
      const transferData = {
        sender: senderUser._id,
        receiver: receiverUser._id,
        amount: transferAmount,
        reference: 'Test transfer'
      };

      const response = await request(app)
        .post('/api/transactions/transfer-money')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(transferData);      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Transaction failed. Insufficient amount');
    });

    it('should fail transfer with invalid sender ID format', async () => {
      const transferData = {
        sender: 'invalid-id', // Invalid ID format
        receiver: receiverUser._id,
        amount: 100,
        reference: 'Test transfer'
      };

      const response = await request(app)
        .post('/api/transactions/transfer-money')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(transferData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Transaction failed');
    });

    it('should fail transfer with invalid receiver ID format', async () => {
      const transferData = {
        sender: senderUser._id,
        receiver: 'invalid-id', // Invalid ID format
        amount: 100,
        reference: 'Test transfer'
      };

      const response = await request(app)
        .post('/api/transactions/transfer-money')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(transferData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Transaction failed');
    });

    it('should fail transfer with invalid amount', async () => {
      const transferData = {
        sender: senderUser._id,
        receiver: receiverUser._id,
        amount: -100, // Negative amount
        reference: 'Test transfer'
      };

      const response = await request(app)
        .post('/api/transactions/transfer-money')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(transferData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid amount');
    });

    it('should fail transfer with non-existent sender', async () => {
      const transferData = {
        sender: invalidUserId, // Valid format but non-existent ID
        receiver: receiverUser._id,
        amount: 100,
        reference: 'Test transfer'
      };

      const response = await request(app)
        .post('/api/transactions/transfer-money')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(transferData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Sender not found');
    });

    it('should verify receiver account successfully', async () => {
      const response = await request(app)
        .post('/api/transactions/verify-account')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          userId: senderUser._id,
          receiver: receiverUser._id
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should fail verification with missing receiver ID', async () => {
      const response = await request(app)
        .post('/api/transactions/verify-account')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          userId: senderUser._id,
          // receiver is missing
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Sender or receiver account number is missing');
    });

    it('should fail verification when sender and receiver are the same', async () => {
      const response = await request(app)
        .post('/api/transactions/verify-account')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          userId: senderUser._id.toString(),
          receiver: senderUser._id.toString()
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Receiver account number can't be the same as sender account number");
    });

    it('should fail verification with invalid receiver ID format', async () => {
      const response = await request(app)
        .post('/api/transactions/verify-account')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          userId: senderUser._id,
          receiver: 'invalid-id'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid receiver account number');
    });

    it('should fail verification with non-existent receiver ID', async () => {
      const response = await request(app)
        .post('/api/transactions/verify-account')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          userId: senderUser._id,
          receiver: invalidUserId // Valid format but non-existent ID
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Account not found');
    });
  });

  describe('Transaction History', () => {
    it('should get all transactions for a user', async () => {
      // Create a test transaction
      await Transaction.create({
        sender: senderUser._id,
        receiver: receiverUser._id,
        amount: 50,
        reference: 'Test transaction',
        status: 'success'
      });

      const response = await request(app)
        .post('/api/transactions/get-all-transactions-by-user')
        .set('Authorization', `Bearer ${senderToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(1);
    });

    it('should handle deleted users in transaction history', async () => {
      // Create a transaction
      const transaction = await Transaction.create({
        sender: senderUser._id,
        receiver: receiverUser._id,
        amount: 75,
        reference: 'Test transaction with deleted user',
        status: 'success'
      });

      // Create a DeletedUser record
      await DeletedUser.create({
        deleteId: receiverUser._id,
        firstName: 'Deleted',
        lastName: 'User',
        transactions: [{ _id: transaction._id }]
      });

      // Set receiver to null to simulate a deleted user
      await Transaction.findByIdAndUpdate(transaction._id, { receiver: null });

      const response = await request(app)
        .post('/api/transactions/get-all-transactions-by-user')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({ userId: senderUser._id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].receiver).toBeDefined();
      expect(response.body.data[0].receiver).toBe(receiverUser._id.toString());
    });

    it('should handle errors when fetching transaction history', async () => {
      // Force an error by using invalid data
      jest.spyOn(Transaction, 'find').mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/api/transactions/get-all-transactions-by-user')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({ userId: 'invalid-data' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Transactions not fetched');
    });
  });

  describe('Deposit', () => {
    it('should initiate deposit process', async () => {
      const depositData = {
        token: {
          id: 'tok_visa',
          email: 'test@example.com'
        },
        amount: 100,
        userId: senderUser._id
      };

      const response = await request(app)
        .post('/api/transactions/deposit-money')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(depositData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('verification code');

      const depositCode = await DepositCode.findOne({ userId: senderUser._id });
      expect(depositCode).toBeDefined();
      expect(depositCode.email).toBe('test@example.com');
    });

    it('should fail deposit with invalid amount', async () => {
      const depositData = {
        token: {
          id: 'tok_visa',
          email: 'test@example.com'
        },
        amount: -50, // Negative amount
        userId: senderUser._id
      };

      const response = await request(app)
        .post('/api/transactions/deposit-money')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(depositData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid amount');
    });

    it('should fail deposit with invalid token data', async () => {
      const depositData = {
        token: {
          // Missing id and email
        },
        amount: 100,
        userId: senderUser._id
      };

      const response = await request(app)
        .post('/api/transactions/deposit-money')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(depositData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid token data');
    });

    it('should fail deposit with invalid user ID', async () => {
      const depositData = {
        token: {
          id: 'tok_visa',
          email: 'test@example.com'
        },
        amount: 100,
        userId: 'invalid-id'
      };

      senderToken = generateTestToken(depositData.userId);

      const response = await request(app)
        .post('/api/transactions/deposit-money')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(depositData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid user ID');
    });

    it('should verify deposit code successfully', async () => {
      // First initiate deposit
      const depositData = {
        token: {
          id: 'tok_visa',
          email: 'test@example.com'
        },
        amount: 100,
        userId: senderUser._id
      };

      await request(app)
        .post('/api/transactions/deposit-money')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(depositData);

      // Get the verification code from the database
      const DepositCode = require('../models/depositCodeModel');
      const depositCode = await DepositCode.findOne({ userId: senderUser._id });

      const verificationData = {
        userId: senderUser._id,
        verificationCode: depositCode.veritificationCode,
        amount: 100
      };

      const response = await request(app)
        .post('/api/transactions/verify-deposit')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(verificationData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify user's balance was increased
      const updatedUser = await User.findById(senderUser._id);
      expect(updatedUser.balance).toBe(1100); // 1000 + 100
    });

    it('should fail verify deposit with invalid amount', async () => {
      const verificationData = {
        userId: senderUser._id,
        verificationCode: '123456',
        amount: -100 // Negative amount
      };

      const response = await request(app)
        .post('/api/transactions/verify-deposit')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(verificationData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid amount');
    });

    it('should fail verify deposit with invalid user ID', async () => {
      const verificationData = {
        userId: 'invalid-id',
        verificationCode: '123456',
        amount: 100
      };

      const response = await request(app)
        .post('/api/transactions/verify-deposit')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(verificationData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired verification code');
    });

    it('should fail verify deposit with invalid verification code', async () => {
      const verificationData = {
        userId: senderUser._id,
        verificationCode: 'invalid-code',
        amount: 100
      };

      const response = await request(app)
        .post('/api/transactions/verify-deposit')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(verificationData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired verification code');
    });

    it('should fail when there is an error in email sending', async () => {
      // Mock nodemailer to throw an error
      jest.spyOn(require('nodemailer'), 'createTransport').mockReturnValueOnce({
        sendMail: jest.fn().mockRejectedValueOnce(new Error('Email error'))
      });

      const depositData = {
        token: {
          id: 'tok_visa',
          email: 'test@example.com'
        },
        amount: 100,
        userId: senderUser._id
      };

      const response = await request(app)
        .post('/api/transactions/deposit-money')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(depositData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Error initiating deposit');
    });

    it('should fail when stripe charge is unsuccessful', async () => {
      // Mock Stripe to return an unsuccessful charge
      const stripe = require('stripe')();
      stripe.charges.create.mockResolvedValueOnce({ status: 'failed' });

      // First initiate deposit
      const depositData = {
        token: {
          id: 'tok_visa',
          email: 'test@example.com'
        },
        amount: 100,
        userId: senderUser._id
      };

      await request(app)
        .post('/api/transactions/deposit-money')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(depositData);

      // Get the verification code from the database
      const depositCode = await DepositCode.findOne({ userId: senderUser._id });

      const verificationData = {
        userId: senderUser._id,
        verificationCode: depositCode.veritificationCode,
        amount: 100
      };

      const response = await request(app)
        .post('/api/transactions/verify-deposit')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(verificationData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Transaction failed');
    });

    it('should handle stripe errors during verification', async () => {
      // Mock Stripe to throw an error
      const stripe = require('stripe')();
      stripe.customers.create.mockRejectedValueOnce(new Error('Stripe error'));

      const depositData = {
        token: {
          id: 'tok_visa',
          email: 'test@example.com'
        },
        amount: 100,
        userId: senderUser._id
      };

      await request(app)
        .post('/api/transactions/deposit-money')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(depositData);

      const depositCode = await DepositCode.findOne({ userId: senderUser._id });

      const verificationData = {
        userId: senderUser._id,
        verificationCode: depositCode.veritificationCode,
        amount: 100
      };

      const response = await request(app)
        .post('/api/transactions/verify-deposit')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(verificationData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Error verifying deposit');
    });

    it('should handle mongoose errors during verification', async () => {
      // Mock mongoose findOne to throw an error
      jest.spyOn(DepositCode, 'findOne').mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const verificationData = {
        userId: senderUser._id,
        verificationCode: '123456',
        amount: 100
      };

      const response = await request(app)
        .post('/api/transactions/verify-deposit')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(verificationData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Error verifying deposit');
    });
  });
});
