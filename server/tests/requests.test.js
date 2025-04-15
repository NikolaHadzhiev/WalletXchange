const request = require('supertest');
const express = require('express');
const User = require('../models/userModel');
const Request = require('../models/requestsModel');
const app = express();
const bcrypt = require('bcryptjs');
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
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Request.deleteMany({});
  });

  describe('Create Money Request', () => {
    it('should create a new money request successfully', async () => {
      const requestData = {
        sender: senderUser._id,
        receiver: receiverUser._id,
        amount: 100,
        description: 'Test money request'
      };

      const response = await request(app)
        .post('/api/requests/send-request')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(requestData);      expect(response.status).toBe(500);
      expect(response.body).toBeDefined();
      expect(response.body.error).toBeDefined();
    });

    it('should reject request if receiver has insufficient balance', async () => {
      const requestData = {
        sender: senderUser._id,
        receiver: receiverUser._id,
        amount: 1000, // More than receiver's balance
        description: 'Test money request'
      };

      const response = await request(app)
        .post('/api/requests/send-request')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(requestData);      expect(response.status).toBe(500);
      expect(response.body).toBeDefined();
      expect(response.body.error).toBeDefined();
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
        .set('Authorization', `Bearer ${senderToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2);
    });
  });
});
