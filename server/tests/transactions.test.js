const request = require('supertest');
const express = require('express');
const User = require('../models/userModel');
const Transaction = require('../models/transactionModel');
const app = express();
const bcrypt = require('bcryptjs');
const { generateTestToken } = require('./setup');

// Import and use relevant middleware
require('dotenv').config({
  path: '.env.development',
});

const transactionRoute = require('../routes/transactionsRoute');
app.use(express.json());
app.use('/api/transactions', transactionRoute);

describe('Transaction Tests', () => {
  let senderUser;
  let receiverUser;
  let senderToken;

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
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Transaction.deleteMany({});
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
  });
});
