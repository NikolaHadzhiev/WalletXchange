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
      expect(response.body.message).toBe('Transaction failed');
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
      expect(response.body.message).toBe('Transaction failed');
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
    
    // Email notification tests
    describe('Email Notifications for Transfers', () => {
      let nodemailer;
      
      beforeEach(() => {
        // Reset the nodemailer mock before each test
        jest.clearAllMocks();
        nodemailer = require('nodemailer');
      });
      
      it('should send email notifications to both sender and receiver on successful transfer', async () => {
        const transferAmount = 100;
        const transferData = {
          sender: senderUser._id,
          receiver: receiverUser._id,
          amount: transferAmount,
          reference: 'Test transfer with email notifications'
        };

        const response = await request(app)
          .post('/api/transactions/transfer-money')
          .set('Authorization', `Bearer ${senderToken}`)
          .send(transferData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        
        // Verify emails were sent
        const mockTransporter = nodemailer.createTransport();
        expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2); // One for sender, one for receiver
        
        // Check sender email
        const senderEmailCall = mockTransporter.sendMail.mock.calls.find(
          call => call[0].to === senderUser.email
        );
        expect(senderEmailCall).toBeDefined();
        expect(senderEmailCall[0].subject).toContain('Money Transfer Confirmation');
        expect(senderEmailCall[0].text).toContain(senderUser.firstName);
        expect(senderEmailCall[0].text).toContain('transaction has been processed successfully');
        expect(senderEmailCall[0].text).toContain('Test transfer with email notifications');
        
        // Check receiver email
        const receiverEmailCall = mockTransporter.sendMail.mock.calls.find(
          call => call[0].to === receiverUser.email
        );
        expect(receiverEmailCall).toBeDefined();
        expect(receiverEmailCall[0].subject).toContain('Money Received');
        expect(receiverEmailCall[0].text).toContain(receiverUser.firstName);
        expect(receiverEmailCall[0].text).toContain('received a new payment');
        expect(receiverEmailCall[0].text).toContain('Test transfer with email notifications');
      });
      
      it('should handle missing email addresses gracefully', async () => {
        // Create users without email addresses
        const userWithoutEmail1 = await User.create({
          firstName: 'No',
          lastName: 'Email1',
          phoneNumber: '1112223333',
          identificationType: 'NATIONAL ID',
          identificationNumber: 'NOEMAIL1',
          address: '123 No Email St',
          password: await bcrypt.hash('TestPass123', 10),
          balance: 1000,
          isVerified: true,
          email: 'noemail1@example.com'
        });
        
        const userWithoutEmail2 = await User.create({
          firstName: 'No',
          lastName: 'Email2',
          phoneNumber: '4445556666',
          identificationType: 'NATIONAL ID',
          identificationNumber: 'NOEMAIL2',
          address: '456 No Email St',
          password: await bcrypt.hash('TestPass123', 10),
          isVerified: true,
          email: 'noemail2@example.com'
        });

        await User.findByIdAndUpdate(userWithoutEmail1._id, { email: null });
        await User.findByIdAndUpdate(userWithoutEmail2._id, { email: null });
        
        const noEmailToken = generateTestToken(userWithoutEmail1._id);
        
        const transferData = {
          sender: userWithoutEmail1._id,
          receiver: userWithoutEmail2._id,
          amount: 100,
          reference: 'Test transfer without emails'
        };

        const response = await request(app)
          .post('/api/transactions/transfer-money')
          .set('Authorization', `Bearer ${noEmailToken}`)
          .send(transferData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        
        // Transaction should succeed even if emails couldn't be sent
        const transaction = await Transaction.findOne({ 
          sender: userWithoutEmail1._id,
          receiver: userWithoutEmail2._id
        });
        expect(transaction).toBeTruthy();
        
        // No emails should be sent (sendMail should not be called)
        const mockTransporter = nodemailer.createTransport();
        expect(mockTransporter.sendMail).not.toHaveBeenCalled();
      });
      
      it('should handle email sending errors gracefully', async () => {
        // Temporarily override console.error
        const originalConsoleError = console.error;
        console.error = jest.fn();
        
        // Set up the mock to fail
        const mockSendMail = jest.fn().mockRejectedValue(new Error('Email sending failed'));
        require('nodemailer').createTransport.mockReturnValue({
          sendMail: mockSendMail
        });
        
        const transferData = {
          sender: senderUser._id,
          receiver: receiverUser._id,
          amount: 100,
          reference: 'Test transfer with email failure'
        };

        const response = await request(app)
          .post('/api/transactions/transfer-money')
          .set('Authorization', `Bearer ${senderToken}`)
          .send(transferData);

        // The transaction should still succeed even if email sending fails
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        
        // Reset the mock to the original implementation for other tests
        require('nodemailer').createTransport.mockReturnValue({
          sendMail: jest.fn().mockResolvedValue(true)
        });

        console.error = originalConsoleError;
      });
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

  // New test group for verify-account endpoint
  describe('Verify Account', () => {
    it('should verify a valid receiver account', async () => {
      const verifyData = {
        userId: senderUser._id,
        receiver: receiverUser._id
      };

      const response = await request(app)
        .post('/api/transactions/verify-account')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(verifyData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Account verified');
      expect(response.body.data).toBeDefined();
    });

    it('should reject when sender or receiver is missing', async () => {
      const verifyData = {
        userId: senderUser._id
        // receiver is missing
      };

      const response = await request(app)
        .post('/api/transactions/verify-account')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(verifyData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Sender or receiver account number is missing');
    });

    it('should reject when sender and receiver are the same', async () => {
      const verifyData = {
        userId: senderUser._id.toString(),
        receiver: senderUser._id.toString()
      };

      const response = await request(app)
        .post('/api/transactions/verify-account')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(verifyData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Receiver account number can\'t be the same as sender account number');
    });

    it('should reject when receiver ID is invalid format', async () => {
      const verifyData = {
        userId: senderUser._id,
        receiver: 'invalid-format'
      };

      const response = await request(app)
        .post('/api/transactions/verify-account')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(verifyData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid receiver account number');
    });

    it('should return not found for non-existent receiver', async () => {
      const verifyData = {
        userId: senderUser._id,
        receiver: invalidUserId
      };

      const response = await request(app)
        .post('/api/transactions/verify-account')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(verifyData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Account not found');
    });

    it('should handle errors in account verification', async () => {
      // Force an error by using invalid data
      jest.spyOn(User, 'findOne').mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const verifyData = {
        userId: senderUser._id,
        receiver: receiverUser._id
      };

      const response = await request(app)
        .post('/api/transactions/verify-account')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(verifyData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Account not found');
    });
  });

  describe('Deposit Tests', () => {
    let nodemailer;
    
    beforeEach(() => {
      // Reset the nodemailer mock before each test
      jest.clearAllMocks();
      nodemailer = require('nodemailer');
    });

    it('should send verification email when initiating a deposit', async () => {
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
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('verification code has been sent');
      
      // Verify email was sent with verification code
      const mockTransporter = nodemailer.createTransport();
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      
      // Check verification email content
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe('test@example.com');
      expect(emailCall.subject).toContain('Deposit Verification Code');
      expect(emailCall.text).toContain('verification code');
      expect(emailCall.text).toMatch(/\d{6}/); // Should contain a 6-digit code
    });

    it('should send confirmation email after successful deposit', async () => {
      // Create a verification code record first
      const verificationCode = '123456';
      await DepositCode.create({
        userId: senderUser._id,
        email: senderUser.email,
        stripeId: 'test_stripe_id',
        veritificationCode: verificationCode,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      });

      const verifyData = {
        userId: senderUser._id,
        verificationCode,
        amount: 100
      };

      const response = await request(app)
        .post('/api/transactions/verify-deposit')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(verifyData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Deposit successful');
      
      // Verify confirmation email was sent
      const mockTransporter = nodemailer.createTransport();
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      
      // Find the confirmation email
      const confirmationEmailCall = mockTransporter.sendMail.mock.calls.find(
        call => call[0].subject.includes('Deposit Successful')
      );
      expect(confirmationEmailCall).toBeDefined();
      expect(confirmationEmailCall[0].to).toBe(senderUser.email);
      expect(confirmationEmailCall[0].text).toContain(senderUser.firstName);
      expect(confirmationEmailCall[0].text).toContain('deposit has been completed successfully');
      expect(confirmationEmailCall[0].text).toContain('Transaction ID:');
    });

    it('should not send confirmation email if user email is missing', async () => {
      // Create user without email
      const userWithoutEmail = await User.create({
        firstName: 'No',
        lastName: 'Email',
        phoneNumber: '1112223333',
        identificationType: 'NATIONAL ID',
        identificationNumber: 'NOEMAIL',
        address: '123 No Email St',
        password: await bcrypt.hash('TestPass123', 10),
        balance: 0,
        isVerified: true,
        email: 'temp@example.com'  // Add this line
      });
      
      await User.findByIdAndUpdate(userWithoutEmail._id, { email: null });

      const noEmailToken = generateTestToken(userWithoutEmail._id);
      
      // Create a verification code record
      const verificationCode = '654321';
      await DepositCode.create({
        userId: userWithoutEmail._id,
        email: 'temporary@example.com', // Email used during deposit but not stored in user profile
        stripeId: 'test_stripe_id_2',
        veritificationCode: verificationCode,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      });

      const verifyData = {
        userId: userWithoutEmail._id,
        verificationCode,
        amount: 100
      };

      const response = await request(app)
        .post('/api/transactions/verify-deposit')
        .set('Authorization', `Bearer ${noEmailToken}`)
        .send(verifyData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Deposit should succeed but no confirmation email should be sent
      const mockTransporter = nodemailer.createTransport();
      const confirmationCalls = mockTransporter.sendMail.mock.calls.filter(
        call => call[0].subject && call[0].subject.includes('Deposit Successful')
      );
      expect(confirmationCalls.length).toBe(0);
      
      // Verify balance was updated despite no email
      const updatedUser = await User.findById(userWithoutEmail._id);
      expect(updatedUser.balance).toBe(100);
    });

    it('should handle email sending errors during deposit confirmation', async () => {
      // Set up the mock to fail for confirmation emails
      const mockSendMail = jest.fn().mockRejectedValue(new Error('Email sending failed'));
      require('nodemailer').createTransport.mockReturnValue({
        sendMail: mockSendMail
      });
      
      // Create a verification code record
      const verificationCode = '789012';
      await DepositCode.create({
        userId: senderUser._id,
        email: senderUser.email,
        stripeId: 'test_stripe_id_3',
        veritificationCode: verificationCode,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      });

      const verifyData = {
        userId: senderUser._id,
        verificationCode,
        amount: 100
      };

      const response = await request(app)
        .post('/api/transactions/verify-deposit')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(verifyData);

      // The deposit should still succeed even if email sending fails
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Verify balance was updated despite email failure
      const updatedUser = await User.findById(senderUser._id);
      expect(updatedUser.balance).toBe(1100); // Original 1000 + 100 deposit
      
      // Reset the mock to the original implementation for other tests
      require('nodemailer').createTransport.mockReturnValue({
        sendMail: jest.fn().mockResolvedValue(true)
      });
    });

    it('should reject deposit with invalid amount', async () => {
      const depositData = {
        userId: senderUser._id,
        amount: -50,  // Invalid negative amount
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
      expect(response.body.message).toBe('Invalid amount');
    });

    it('should reject deposit with invalid token data', async () => {
      const depositData = {
        userId: senderUser._id,
        amount: 100,
        token: {} // Empty token object
      };

      const response = await request(app)
        .post('/api/transactions/deposit-money')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(depositData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid token data');
    });

    it('should reject deposit with invalid user ID', async () => {
      const depositData = {
        userId: 'invalid-id',
        amount: 100,
        token: {
          id: 'test_token_id',
          email: 'test@example.com'
        }
      };
      
      senderToken = generateTestToken(depositData.userId);
      
      const response = await request(app)
        .post('/api/transactions/deposit-money')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(depositData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      // Additional tests for new/updated logic in transactionsRoute and PayPal endpoints

      describe('PayPal Deposit & Withdrawal', () => {
        let senderUser, senderToken;

        beforeEach(async () => {
          const hashedPassword = await bcrypt.hash('TestPass123', 10);
          senderUser = await User.create({
            firstName: 'PayPal',
            lastName: 'User',
            email: 'paypaluser@example.com',
            phoneNumber: '5555555555',
            identificationType: 'NATIONAL ID',
            identificationNumber: 'PAYPAL123',
            address: '789 PayPal St',
            password: hashedPassword,
            balance: 500,
            isVerified: true
          });
          senderToken = generateTestToken(senderUser._id);
        });

        afterEach(async () => {
          await User.deleteMany({});
          await Transaction.deleteMany({});
          await DepositCode.deleteMany({});
          await DeletedUser.deleteMany({});
        });

        it('should create a PayPal order', async () => {
          const payload = { userId: senderUser._id, amount: 50 };
          const response = await request(app)
            .post('/api/paypal/create-paypal-order')
            .set('Authorization', `Bearer ${senderToken}`)
            .send(payload);

          expect(response.status).toBe(200);
          expect(response.body).toHaveProperty('success');
        });

        it('should fail to create a PayPal order with invalid amount', async () => {
          const payload = { userId: senderUser._id, amount: -10 };
          const response = await request(app)
            .post('/api/paypal/create-paypal-order')
            .set('Authorization', `Bearer ${senderToken}`)
            .send(payload);

          expect(response.status).toBe(200);
          expect(response.body.success).toBe(false);
          expect(response.body.message).toMatch(/invalid amount/i);
        });

        it('should fail to create a PayPal order with missing userId', async () => {
          const payload = { amount: 50 };
          const response = await request(app)
            .post('/api/paypal/create-paypal-order')
            .set('Authorization', `Bearer ${senderToken}`)
            .send(payload);

          expect(response.status).toBe(200);
          expect(response.body.success).toBe(false);
          expect(response.body.message).toMatch(/user id/i);
        });

        it('should handle error in create PayPal order', async () => {
          jest.spyOn(Transaction, 'create').mockImplementationOnce(() => { throw new Error('DB error'); });
          const payload = { userId: senderUser._id, amount: 50 };
          const response = await request(app)
            .post('/api/paypal/create-paypal-order')
            .set('Authorization', `Bearer ${senderToken}`)
            .send(payload);

          expect(response.status).toBe(200);
          expect(response.body.success).toBe(false);
        });

        it('should request PayPal verification code', async () => {
          const payload = { userId: senderUser._id, orderId: 'ORDER123', email: 'paypaluser@example.com' };
          const response = await request(app)
            .post('/api/paypal/request-verification')
            .set('Authorization', `Bearer ${senderToken}`)
            .send(payload);

          expect(response.status).toBe(200);
          expect(response.body).toHaveProperty('success');
        });

        it('should fail to request PayPal verification code with missing fields', async () => {
          const payload = { userId: senderUser._id, orderId: 'ORDER123' }; // missing email
          const response = await request(app)
            .post('/api/paypal/request-verification')
            .set('Authorization', `Bearer ${senderToken}`)
            .send(payload);

          expect(response.status).toBe(200);
          expect(response.body.success).toBe(false);
          expect(response.body.message).toMatch(/email/i);
        });

        it('should handle error in request PayPal verification code', async () => {
          jest.spyOn(DepositCode, 'create').mockImplementationOnce(() => { throw new Error('DB error'); });
          const payload = { userId: senderUser._id, orderId: 'ORDER123', email: 'paypaluser@example.com' };
          const response = await request(app)
            .post('/api/paypal/request-verification')
            .set('Authorization', `Bearer ${senderToken}`)
            .send(payload);

          expect(response.status).toBe(200);
          expect(response.body.success).toBe(false);
        });

        it('should verify PayPal deposit', async () => {
          await DepositCode.create({
            userId: senderUser._id,
            email: senderUser.email,
            stripeId: 'paypal_order_id',
            veritificationCode: '112233',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000)
          });
          const payload = { userId: senderUser._id, verificationCode: '112233', amount: 50, orderId: 'paypal_order_id' };
          const response = await request(app)
            .post('/api/paypal/verify-paypal')
            .set('Authorization', `Bearer ${senderToken}`)
            .send(payload);

          expect(response.status).toBe(200);
          expect(response.body).toHaveProperty('success');
        });

        it('should fail PayPal deposit verification with wrong code', async () => {
          const payload = { userId: senderUser._id, verificationCode: 'wrong', amount: 50, orderId: 'paypal_order_id' };
          const response = await request(app)
            .post('/api/paypal/verify-paypal')
            .set('Authorization', `Bearer ${senderToken}`)
            .send(payload);

          expect(response.status).toBe(200);
          expect(response.body.success).toBe(false);
          expect(response.body.message).toMatch(/invalid or expired/i);
        });

        it('should handle error in verify PayPal deposit', async () => {
          jest.spyOn(User, 'findById').mockImplementationOnce(() => { throw new Error('DB error'); });
          const payload = { userId: senderUser._id, verificationCode: '112233', amount: 50, orderId: 'paypal_order_id' };
          const response = await request(app)
            .post('/api/paypal/verify-paypal')
            .set('Authorization', `Bearer ${senderToken}`)
            .send(payload);

          expect(response.status).toBe(200);
          expect(response.body.success).toBe(false);
        });

        it('should request PayPal withdrawal', async () => {
          const payload = { userId: senderUser._id, amount: 50, email: 'paypaluser@example.com' };
          const response = await request(app)
            .post('/api/paypal/withdraw-paypal')
            .set('Authorization', `Bearer ${senderToken}`)
            .send(payload);

          expect(response.status).toBe(200);
          expect(response.body).toHaveProperty('success');
        });

        it('should fail PayPal withdrawal with missing email', async () => {
          const payload = { userId: senderUser._id, amount: 50 };
          const response = await request(app)
            .post('/api/paypal/withdraw-paypal')
            .set('Authorization', `Bearer ${senderToken}`)
            .send(payload);

          expect(response.status).toBe(200);
          expect(response.body.success).toBe(false);
          expect(response.body.message).toMatch(/email/i);
        });

        it('should handle error in request PayPal withdrawal', async () => {
          jest.spyOn(DepositCode, 'create').mockImplementationOnce(() => { throw new Error('DB error'); });
          const payload = { userId: senderUser._id, amount: 50, email: 'paypaluser@example.com' };
          const response = await request(app)
            .post('/api/paypal/withdraw-paypal')
            .set('Authorization', `Bearer ${senderToken}`)
            .send(payload);

          expect(response.status).toBe(200);
          expect(response.body.success).toBe(false);
        });

        it('should verify PayPal withdrawal', async () => {
          await DepositCode.create({
            userId: senderUser._id,
            email: senderUser.email,
            stripeId: 'paypal_withdraw_id',
            veritificationCode: '445566',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000)
          });
          const payload = { userId: senderUser._id, verificationCode: '445566', amount: 50, withdrawId: 'paypal_withdraw_id' };
          const response = await request(app)
            .post('/api/paypal/verify-withdraw-paypal')
            .set('Authorization', `Bearer ${senderToken}`)
            .send(payload);

          expect(response.status).toBe(200);
          expect(response.body).toHaveProperty('success');
        });

        it('should fail PayPal withdrawal verification with wrong code', async () => {
          const payload = { userId: senderUser._id, verificationCode: 'wrong', amount: 50, withdrawId: 'paypal_withdraw_id' };
          const response = await request(app)
            .post('/api/paypal/verify-withdraw-paypal')
            .set('Authorization', `Bearer ${senderToken}`)
            .send(payload);

          expect(response.status).toBe(200);
          expect(response.body.success).toBe(false);
          expect(response.body.message).toMatch(/invalid or expired/i);
        });

        it('should handle error in verify PayPal withdrawal', async () => {
          jest.spyOn(User, 'findById').mockImplementationOnce(() => { throw new Error('DB error'); });
          const payload = { userId: senderUser._id, verificationCode: '445566', amount: 50, withdrawId: 'paypal_withdraw_id' };
          const response = await request(app)
            .post('/api/paypal/verify-withdraw-paypal')
            .set('Authorization', `Bearer ${senderToken}`)
            .send(payload);

          expect(response.status).toBe(200);
          expect(response.body.success).toBe(false);
        });
      });

      // Edge case: missing Authorization header
      describe('Authorization edge cases', () => {
        it('should reject requests without Authorization header', async () => {
          const response = await request(app)
            .post('/api/transactions/transfer-money')
            .send({});

          expect(response.status).toBe(401);
        });

        it('should reject PayPal endpoints without Authorization header', async () => {
          const response = await request(app)
            .post('/api/paypal/create-paypal-order')
            .send({});

          expect(response.status).toBe(401);
        });
      });

      // Edge case: invalid JSON body
      describe('Invalid JSON body', () => {
        it('should handle invalid JSON body gracefully', async () => {
          const response = await request(app)
            .post('/api/transactions/transfer-money')
            .set('Authorization', 'Bearer invalidtoken')
            .set('Content-Type', 'application/json')
            .send('not-a-json');

          expect(response.status).toBeGreaterThanOrEqual(400);
        });
      });

      // Edge case: unknown route
      describe('Unknown route', () => {
        it('should return 404 for unknown route', async () => {
          const response = await request(app)
            .post('/api/transactions/unknown-route')
            .set('Authorization', 'Bearer sometoken')
            .send({});

          expect(response.status).toBe(404);
        });
      });

      // Edge case: GET on POST-only endpoint
      describe('Method not allowed', () => {
        it('should return 404 for GET on POST-only endpoint', async () => {
          const response = await request(app)
            .get('/api/transactions/transfer-money')
            .set('Authorization', 'Bearer sometoken');

          expect(response.status).toBe(404);
        });
      });

      // We recommend installing an extension to run jest tests.

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Error initiating deposit');
    });

    // Tests for verify-deposit endpoint
    it('should reject verification with invalid amount', async () => {
      const verifyData = {
        userId: senderUser._id,
        verificationCode: '123456',
        amount: -50 // Invalid amount
      };

      const response = await request(app)
        .post('/api/transactions/verify-deposit')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(verifyData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid amount');
    });

    it('should reject verification with invalid user ID', async () => {
      const verifyData = {
        userId: 'invalid-id',
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

    it('should reject verification with invalid or expired code', async () => {
      const verifyData = {
        userId: senderUser._id,
        verificationCode: 'invalid-code',
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

    it('should handle stripe charge failure', async () => {
      // Create a verification code record first
      const verificationCode = '654321';
      await DepositCode.create({
        userId: senderUser._id,
        email: senderUser.email,
        stripeId: 'test_stripe_id',
        veritificationCode: verificationCode,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      });

      // Mock stripe charge failure
      require('stripe')().charges.create.mockResolvedValueOnce({ status: 'failed' });

      const verifyData = {
        userId: senderUser._id,
        verificationCode,
        amount: 100
      };

      const response = await request(app)
        .post('/api/transactions/verify-deposit')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(verifyData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Transaction failed');
    });

    it('should handle generic errors during deposit verification', async () => {
      const verificationCode = '987654';
      await DepositCode.create({
        userId: senderUser._id,
        email: senderUser.email,
        stripeId: 'test_stripe_id',
        veritificationCode: verificationCode,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      });
      
      // Force an error during stripe customer creation
      require('stripe')().customers.create.mockRejectedValueOnce(new Error('Stripe API error'));

      const verifyData = {
        userId: senderUser._id,
        verificationCode,
        amount: 100
      };

      const response = await request(app)
        .post('/api/transactions/verify-deposit')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(verifyData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Error verifying deposit');
    });
  });
});
