const request = require('supertest');
const express = require('express');
const User = require('../models/userModel');
const Request = require('../models/requestsModel');
const Transaction = require('../models/transactionModel');
const DeletedUser = require('../models/deletedUserModel');
const app = express();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { generateTestToken } = require('./setup');

require('dotenv').config({
  path: '.env.development',
});

const requestsRoute = require('../routes/requestsRoute');
app.use(express.json());
app.use('/api/requests', requestsRoute);

describe('Money Request Tests', () => {
  let senderUser;
  let receiverUser;
  let senderToken;
  let receiverToken;
  let invalidId;

  beforeEach(async () => {
    const hashedPassword = await bcrypt.hash('TestPass123', 10);
    
    // Create sender user
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
      balance: 500,
      isVerified: true
    });

    senderToken = generateTestToken(senderUser._id);
    receiverToken = generateTestToken(receiverUser._id);
    invalidId = new mongoose.Types.ObjectId(); // Valid format but non-existent ID
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Request.deleteMany({});
    await Transaction.deleteMany({});
    await DeletedUser.deleteMany({});
  });

  describe('Create Money Request', () => {
    it('should create a new money request successfully', async () => {
      const requestData = {
        userId: senderUser._id, // Adding userId field required by the route
        receiver: receiverUser._id,
        amount: 100,
        reference: 'Test money request'  // Using reference instead of description to match route code
      };

      const response = await request(app)
        .post('/api/requests/send-request')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(requestData);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Request sent successfully');
      
      // Verify request was created in the database
      const savedRequest = await Request.findOne({ sender: senderUser._id });
      expect(savedRequest).toBeTruthy();
      expect(savedRequest.amount).toBe(100);
    });

    it('should reject request if receiver has insufficient balance', async () => {
      const requestData = {
        userId: senderUser._id,
        receiver: receiverUser._id,
        amount: 1000, // More than receiver's balance
        reference: 'Test money request'
      };

      const response = await request(app)
        .post('/api/requests/send-request')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(requestData);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not have enough money');
    });

    // Testing validation errors
    it('should fail with validation errors for invalid input', async () => {
      const invalidRequestData = {
        userId: senderUser._id,
        receiver: 'invalid-id', // Invalid receiver ID format
        amount: -100, // Invalid amount
        reference: 'Test money request'
      };

      const response = await request(app)
        .post('/api/requests/send-request')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(invalidRequestData);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toBeDefined();
    });

    // Testing error handling
    it('should handle errors in send-request', async () => {
      // Mock a scenario where User.findById throws an error
      const originalFindById = User.findById;
      User.findById = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      const requestData = {
        userId: senderUser._id,
        receiver: receiverUser._id,
        amount: 100,
        reference: 'Test money request'
      };

      const response = await request(app)
        .post('/api/requests/send-request')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(requestData);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
      
      // Restore the original function
      User.findById = originalFindById;
    });
  });

  describe('Handle Money Requests', () => {
    it('should allow receiver to accept a request', async () => {
      // Create a request first
      const moneyRequest = await Request.create({
        sender: senderUser._id,
        receiver: receiverUser._id,
        amount: 100,
        description: 'Test request',
        status: 'pending'
      });

      const response = await request(app)
        .post('/api/requests/update-request-status')
        .set('Authorization', `Bearer ${receiverToken}`)
        .send({
          _id: moneyRequest._id,
          status: 'accepted',
          sender: { _id: senderUser._id },
          receiver: { _id: receiverUser._id },
          amount: 100,
          description: 'Test request'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify balances were updated
      const updatedSender = await User.findById(senderUser._id);
      const updatedReceiver = await User.findById(receiverUser._id);
      expect(updatedSender.balance).toBe(1100); // 1000 + 100
      expect(updatedReceiver.balance).toBe(400); // 500 - 100
      
      // Verify a transaction was created
      const transaction = await Transaction.findOne({ 
        sender: receiverUser._id,
        receiver: senderUser._id
      });
      expect(transaction).toBeTruthy();
      expect(transaction.amount).toBe(100);
    });

    it('should allow receiver to reject a request', async () => {
      // Create a request first
      const moneyRequest = await Request.create({
        sender: senderUser._id,
        receiver: receiverUser._id,
        amount: 100,
        description: 'Test request',
        status: 'pending'
      });

      const response = await request(app)
        .post('/api/requests/update-request-status')
        .set('Authorization', `Bearer ${receiverToken}`)
        .send({
          _id: moneyRequest._id,
          status: 'rejected',
          sender: { _id: senderUser._id },
          receiver: { _id: receiverUser._id },
          amount: 100,
          description: 'Test request'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify request status was updated
      const updatedRequest = await Request.findById(moneyRequest._id);
      expect(updatedRequest.status).toBe('rejected');
    });

    // Testing validation errors
    it('should fail update with validation errors for invalid input', async () => {
      const invalidUpdateData = {
        _id: 'invalid-id', // Invalid request ID
        status: 'invalid-status', // Invalid status
        sender: { _id: 'invalid-sender' },
        receiver: { _id: 'invalid-receiver' },
        amount: -100,
        description: 'Test request'
      };

      const response = await request(app)
        .post('/api/requests/update-request-status')
        .set('Authorization', `Bearer ${receiverToken}`)
        .send(invalidUpdateData);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toBeDefined();
    });

    // Testing error handling
    it('should handle errors in update-request-status', async () => {
      // Create a request first
      const moneyRequest = await Request.create({
        sender: senderUser._id,
        receiver: receiverUser._id,
        amount: 100,
        description: 'Test request',
        status: 'pending'
      });

      // Mock a scenario where Request.findByIdAndUpdate throws an error
      const originalFindByIdAndUpdate = Request.findByIdAndUpdate;
      Request.findByIdAndUpdate = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/api/requests/update-request-status')
        .set('Authorization', `Bearer ${receiverToken}`)
        .send({
          _id: moneyRequest._id,
          status: 'accepted',
          sender: { _id: senderUser._id },
          receiver: { _id: receiverUser._id },
          amount: 100,
          description: 'Test request'
        });
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Database error');
      
      // Restore the original function
      Request.findByIdAndUpdate = originalFindByIdAndUpdate;
    });
  });

  describe('Get Money Requests', () => {
    it('should get all requests for a user', async () => {
      // Create test requests
      await Request.create([
        {
          sender: senderUser._id,
          receiver: receiverUser._id,
          amount: 100,
          description: 'Test request 1',
          status: 'pending'
        },
        {
          sender: receiverUser._id,
          receiver: senderUser._id,
          amount: 200,
          description: 'Test request 2',
          status: 'pending'
        }
      ]);

      const response = await request(app)
        .post('/api/requests/get-all-requests-by-user')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({ userId: senderUser._id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2);
    });

    // Testing deleted users handling
    it('should handle deleted users in the request history', async () => {
      // Create a request
      const testRequest = await Request.create({
        sender: senderUser._id,
        receiver: receiverUser._id,
        amount: 150,
        description: 'Request with deleted user',
        status: 'pending'
      });

      // Create a DeletedUser record
      await DeletedUser.create({
        deleteId: receiverUser._id,
        firstName: 'Deleted',
        lastName: 'User',
        requests: [{ _id: testRequest._id }]
      });

      // Set receiver to null to simulate a deleted user
      await Request.findByIdAndUpdate(testRequest._id, { receiver: null });

      const response = await request(app)
        .post('/api/requests/get-all-requests-by-user')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({ userId: senderUser._id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].receiver).toBeTruthy();
      expect(response.body.data[0].receiver).toBe(receiverUser._id.toString());
    });

    // Test deleted sender scenario
    it('should handle deleted senders in the request history', async () => {
      // Create a request
      const testRequest = await Request.create({
        sender: senderUser._id,
        receiver: receiverUser._id,
        amount: 150,
        description: 'Request with deleted sender',
        status: 'pending'
      });

      // Create a DeletedUser record
      await DeletedUser.create({
        deleteId: senderUser._id,
        firstName: 'Deleted',
        lastName: 'Sender',
        requests: [{ _id: testRequest._id }]
      });

      // Set sender to null to simulate a deleted user
      await Request.findByIdAndUpdate(testRequest._id, { sender: null });

      const response = await request(app)
        .post('/api/requests/get-all-requests-by-user')
        .set('Authorization', `Bearer ${receiverToken}`)
        .send({ userId: receiverUser._id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].sender).toBeTruthy();
      expect(response.body.data[0].sender).toBe(senderUser._id.toString());
    });

    // Testing error handling
    it('should handle errors in get-all-requests-by-user', async () => {
      // Mock a scenario where Request.find throws an error
      const originalFind = Request.find;
      Request.find = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/api/requests/get-all-requests-by-user')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({ userId: senderUser._id });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Database error');
      
      // Restore the original function
      Request.find = originalFind;
    });
  });

  // Additional tests for edge cases in update-request-status
  describe('Update Request Status Edge Cases', () => {
    it('should update a request to pending status without transaction', async () => {
      // Create a request first
      const moneyRequest = await Request.create({
        sender: senderUser._id,
        receiver: receiverUser._id,
        amount: 100,
        description: 'Test request',
        status: 'rejected'  // Starting from rejected
      });

      // Initial balances
      const initialSenderBalance = 1000;
      const initialReceiverBalance = 500;

      const response = await request(app)
        .post('/api/requests/update-request-status')
        .set('Authorization', `Bearer ${receiverToken}`)
        .send({
          _id: moneyRequest._id,
          status: 'pending',  // Change to pending
          sender: { _id: senderUser._id },
          receiver: { _id: receiverUser._id },
          amount: 100,
          description: 'Test request'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify request status was updated
      const updatedRequest = await Request.findById(moneyRequest._id);
      expect(updatedRequest.status).toBe('pending');

      // Verify balances remain unchanged
      const finalSender = await User.findById(senderUser._id);
      const finalReceiver = await User.findById(receiverUser._id);
      expect(finalSender.balance).toBe(initialSenderBalance);
      expect(finalReceiver.balance).toBe(initialReceiverBalance);

      // Verify no transaction was created
      const transactions = await Transaction.find({});
      expect(transactions.length).toBe(0);
    });
  });
});