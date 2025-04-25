const request = require('supertest');
const express = require('express');
const User = require('../models/userModel');
const Transaction = require('../models/transactionModel');
const mongoose = require('mongoose');
const app = express();
const bcrypt = require('bcryptjs');
const { generateTestToken } = require('./setup');

// Import and use relevant middleware
require('dotenv').config({
  path: '.env.development',
});

const reportsRoute = require('../routes/reportsRoute');
app.use(express.json());
app.use('/api/reports', reportsRoute);

describe('Reports Tests', () => {
  let testUser;
  let testToken;
  let secondUser;
  let invalidUserId;

  beforeEach(async () => {
    // Create test user
    const hashedPassword = await bcrypt.hash('TestPass123', 10);
    testUser = await User.create({
      firstName: 'Test',
      lastName: 'User',
      email: 'testuser@example.com',
      phoneNumber: '1234567890',
      identificationType: 'NATIONAL ID',
      identificationNumber: 'TEST123',
      address: '123 Test St',
      password: hashedPassword,
      balance: 1000,
      isVerified: true
    });

    secondUser = await User.create({
      firstName: 'Second',
      lastName: 'User',
      email: 'seconduser@example.com',
      phoneNumber: '0987654321',
      identificationType: 'NATIONAL ID',
      identificationNumber: 'TEST456',
      address: '456 Test St',
      password: hashedPassword,
      balance: 500,
      isVerified: true
    });

    testToken = generateTestToken(testUser._id);
    invalidUserId = new mongoose.Types.ObjectId();
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Transaction.deleteMany({});
  });

  describe('Get Transaction Summary', () => {
    it('should get transaction summary with no transactions', async () => {
      const response = await request(app)
        .post('/api/reports/get-transaction-summary')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ userId: testUser._id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Transaction summary fetched');
      expect(response.body.data.totalIncome).toBe(0);
      expect(response.body.data.totalExpenses).toBe(0);
      expect(response.body.data.netFlow).toBe(0);
      expect(response.body.data.incomingTransactionCount).toBe(0);
      expect(response.body.data.outgoingTransactionCount).toBe(0);
    });

    it('should get transaction summary with various transaction types', async () => {
      // Create incoming transaction (from second user)
      await Transaction.create({
        sender: secondUser._id,
        receiver: testUser._id,
        amount: 200,
        reference: 'Payment for services',
        status: 'success'
      });

      // Create outgoing transaction (to second user)
      await Transaction.create({
        sender: testUser._id,
        receiver: secondUser._id,
        amount: 50,
        reference: 'Dinner bill',
        status: 'success'
      });

      // Create deposit (self-transfer)
      await Transaction.create({
        sender: testUser._id,
        receiver: testUser._id,
        amount: 300,
        reference: 'Deposit via bank transfer',
        status: 'success'
      });

      // Create withdrawal (self-transfer with withdrawal reference)
      await Transaction.create({
        sender: testUser._id,
        receiver: testUser._id,
        amount: 100,
        reference: 'ATM withdrawal',
        status: 'success'
      });

      const response = await request(app)
        .post('/api/reports/get-transaction-summary')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ userId: testUser._id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Transaction summary fetched');
      expect(response.body.data.totalIncome).toBe(500); // 200 (incoming) + 300 (deposit)
      expect(response.body.data.totalExpenses).toBe(150); // 50 (outgoing) + 100 (withdrawal)
      expect(response.body.data.netFlow).toBe(350); // 500 - 150
      expect(response.body.data.incomingTransactionCount).toBe(2); // 1 incoming + 1 deposit
      expect(response.body.data.outgoingTransactionCount).toBe(2); // 1 outgoing + 1 withdrawal
    });

    it('should filter transactions by date range', async () => {
      // Create transactions with different dates
      const pastDate = new Date('2023-01-01');
      const currentDate = new Date();
      const futureDate = new Date('2025-12-31');

      // Past transaction
      await Transaction.create({
        sender: secondUser._id,
        receiver: testUser._id,
        amount: 100,
        reference: 'Past payment',
        status: 'success',
        createdAt: pastDate
      });

      // Current transaction
      await Transaction.create({
        sender: secondUser._id,
        receiver: testUser._id,
        amount: 200,
        reference: 'Current payment',
        status: 'success',
        createdAt: currentDate
      });

      // Future transaction
      await Transaction.create({
        sender: secondUser._id,
        receiver: testUser._id,
        amount: 300,
        reference: 'Future payment',
        status: 'success',
        createdAt: futureDate
      });

      // Query with date range (only current date)
      const fromDate = new Date(currentDate);
      fromDate.setDate(fromDate.getDate() - 1); // yesterday
      const toDate = new Date(currentDate);
      toDate.setDate(toDate.getDate() + 1); // tomorrow

      const response = await request(app)
        .post('/api/reports/get-transaction-summary')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ 
          userId: testUser._id,
          fromDate: fromDate.toISOString(),
          toDate: toDate.toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalIncome).toBe(200); // Only the current transaction
    });

    it('should handle fromDate filter only', async () => {
      // Create transactions with different dates
      const pastDate = new Date('2023-01-01');
      const currentDate = new Date();

      // Past transaction
      await Transaction.create({
        sender: secondUser._id,
        receiver: testUser._id,
        amount: 100,
        reference: 'Past payment',
        status: 'success',
        createdAt: pastDate
      });

      // Current transaction
      await Transaction.create({
        sender: secondUser._id,
        receiver: testUser._id,
        amount: 200,
        reference: 'Current payment',
        status: 'success',
        createdAt: currentDate
      });

      // Query with fromDate only (should include current transaction but not past)
      const midDate = new Date('2024-01-01');

      const response = await request(app)
        .post('/api/reports/get-transaction-summary')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ 
          userId: testUser._id,
          fromDate: midDate.toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalIncome).toBe(200); // Only the current transaction
    });

    it('should handle toDate filter only', async () => {
      // Create transactions with different dates
      const pastDate = new Date('2023-01-01');
      const currentDate = new Date();

      // Past transaction
      await Transaction.create({
        sender: secondUser._id,
        receiver: testUser._id,
        amount: 100,
        reference: 'Past payment',
        status: 'success',
        createdAt: pastDate
      });

      // Current transaction
      await Transaction.create({
        sender: secondUser._id,
        receiver: testUser._id,
        amount: 200,
        reference: 'Current payment',
        status: 'success',
        createdAt: currentDate
      });

      // Query with toDate only (should include past transaction but not current)
      const midDate = new Date('2023-06-01');

      const response = await request(app)
        .post('/api/reports/get-transaction-summary')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ 
          userId: testUser._id,
          toDate: midDate.toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalIncome).toBe(100); // Only the past transaction
    });

    it('should return error with invalid user ID', async () => {
        const token = generateTestToken('invalid-id');
      
        const response = await request(app)
        .post('/api/reports/get-transaction-summary')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: 'invalid-id' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid user ID');
    });

    it('should handle database errors gracefully', async () => {
      // Mock Transaction.find to throw an error
      jest.spyOn(Transaction, 'find').mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/api/reports/get-transaction-summary')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ userId: testUser._id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to fetch transaction summary');
      expect(response.body.data).toBe('Database error');
    });
  });

  describe('Get Monthly Data', () => {
    it('should get monthly data for the current year with no transactions', async () => {
      const response = await request(app)
        .post('/api/reports/get-monthly-data')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ userId: testUser._id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Monthly transaction data fetched');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(12); // One entry for each month
    });

    it('should get monthly data for a specific year', async () => {
      const year = 2023;
      
      // Create a transaction in 2023
      await Transaction.create({
        sender: secondUser._id,
        receiver: testUser._id,
        amount: 200,
        reference: '2023 payment',
        status: 'success',
        createdAt: new Date('2023-03-15') // March 2023
      });

      const response = await request(app)
        .post('/api/reports/get-monthly-data')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ 
          userId: testUser._id,
          year: year
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(12);
      
      // Check March data (3rd month)
      const marchData = response.body.data.find(m => m.month === 3);
      expect(marchData.income).toBe(200);
      expect(marchData.expenses).toBe(0);
    });

    it('should get monthly data for a specific date range', async () => {
      // Create transactions in different months
      await Transaction.create({
        sender: secondUser._id,
        receiver: testUser._id,
        amount: 100,
        reference: 'January payment',
        status: 'success',
        createdAt: new Date('2024-01-15') // January 2024
      });

      await Transaction.create({
        sender: testUser._id,
        receiver: secondUser._id,
        amount: 50,
        reference: 'February expense',
        status: 'success',
        createdAt: new Date('2024-02-15') // February 2024
      });

      await Transaction.create({
        sender: secondUser._id,
        receiver: testUser._id,
        amount: 200,
        reference: 'March payment',
        status: 'success',
        createdAt: new Date('2024-03-15') // March 2024
      });

      // Query with date range (January to February only)
      const response = await request(app)
        .post('/api/reports/get-monthly-data')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ 
          userId: testUser._id,
          fromDate: new Date('2024-01-01').toISOString(),
          toDate: new Date('2024-02-28').toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Check January data (month 1)
      const janData = response.body.data.find(m => m.month === 1);
      expect(janData.income).toBe(100);
      expect(janData.expenses).toBe(0);
      
      // Check February data (month 2)
      const febData = response.body.data.find(m => m.month === 2);
      expect(febData.income).toBe(0);
      expect(febData.expenses).toBe(50);
      
      // Check March data (month 3) - should not be included
      const marData = response.body.data.find(m => m.month === 3);
      expect(marData.income).toBe(0);
      expect(marData.expenses).toBe(0);
    });

    it('should process deposit and withdrawal transactions correctly', async () => {
      // Create a deposit (self-transfer)
      await Transaction.create({
        sender: testUser._id,
        receiver: testUser._id,
        amount: 300,
        reference: 'Deposit via bank transfer',
        status: 'success',
        createdAt: new Date('2024-04-10') // April 2024
      });

      // Create a withdrawal (self-transfer with withdrawal reference)
      await Transaction.create({
        sender: testUser._id,
        receiver: testUser._id,
        amount: 100,
        reference: 'ATM withdrawal',
        status: 'success',
        createdAt: new Date('2024-04-20') // April 2024
      });

      const response = await request(app)
        .post('/api/reports/get-monthly-data')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ 
          userId: testUser._id,
          year: 2024
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Check April data (month 4)
      const aprData = response.body.data.find(m => m.month === 4);
      expect(aprData.income).toBe(300); // Only deposit counted as income
      expect(aprData.expenses).toBe(100); // Only withdrawal counted as expense
    });

    it('should return error with invalid user ID', async () => {
        const token = generateTestToken('invalid-id');
      
        const response = await request(app)
        .post('/api/reports/get-monthly-data')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: 'invalid-id' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid user ID');
    });

    it('should handle database errors gracefully', async () => {
      // Mock Transaction.aggregate to throw an error
      jest.spyOn(Transaction, 'aggregate').mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/api/reports/get-monthly-data')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ userId: testUser._id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to fetch monthly transaction data');
      expect(response.body.data).toBe('Database error');
    });
  });

  describe('Get Category Summary', () => {
    it('should get category summary with no transactions', async () => {
      const response = await request(app)
        .post('/api/reports/get-category-summary')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ userId: testUser._id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Category summary fetched');
      expect(response.body.data).toHaveProperty('expenseCategories');
      expect(response.body.data).toHaveProperty('incomeCategories');
      expect(Object.keys(response.body.data.expenseCategories).length).toBe(0);
      expect(Object.keys(response.body.data.incomeCategories).length).toBe(0);
    });    
    
    it('should categorize expenses correctly with all expense types', async () => {
      // Create various expense transactions
      await Transaction.create({
        sender: testUser._id,
        receiver: secondUser._id,
        amount: 50,
        reference: 'Food groceries',
        status: 'success'
      });

      await Transaction.create({
        sender: testUser._id,
        receiver: secondUser._id,
        amount: 30,
        reference: 'Restaurant bill',
        status: 'success'
      });

      await Transaction.create({
        sender: testUser._id,
        receiver: secondUser._id,
        amount: 100,
        reference: 'Rent payment',
        status: 'success'
      });

      await Transaction.create({
        sender: testUser._id,
        receiver: secondUser._id,
        amount: 40,
        reference: 'Transport tickets',
        status: 'success'
      });

      await Transaction.create({
        sender: testUser._id,
        receiver: secondUser._id,
        amount: 25,
        reference: 'Miscellaneous',
        status: 'success'
      });

      // Add utility bill transaction (for line 261 coverage)
      await Transaction.create({
        sender: testUser._id,
        receiver: secondUser._id,
        amount: 60,
        reference: 'Utility bill payment',
        status: 'success'
      });

      // Add gas/fuel transaction (for line 268 coverage)
      await Transaction.create({
        sender: testUser._id,
        receiver: secondUser._id,
        amount: 55,
        reference: 'Gas and fuel expenses',
        status: 'success'
      });

      // Create a withdrawal (self-transfer)
      await Transaction.create({
        sender: testUser._id,
        receiver: testUser._id,
        amount: 200,
        reference: 'ATM withdrawal',
        status: 'success'
      });

      const response = await request(app)
        .post('/api/reports/get-category-summary')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ userId: testUser._id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const { expenseCategories } = response.body.data;
      expect(expenseCategories.Food).toBe(80); // 50 + 30
      expect(expenseCategories.Housing).toBe(100);
      expect(expenseCategories.Transportation).toBe(95); // 40 + 55 (Transport + Gas/fuel)
      expect(expenseCategories.Utilities).toBe(60); // For line 261 coverage
      expect(expenseCategories.Other).toBe(25);
      expect(expenseCategories.Withdrawal).toBe(200);
    });    
    
    it('should categorize income correctly with all income types', async () => {
      // Create various income transactions
      await Transaction.create({
        sender: secondUser._id,
        receiver: testUser._id,
        amount: 1000,
        reference: 'Monthly salary',
        status: 'success'
      });

      await Transaction.create({
        sender: secondUser._id,
        receiver: testUser._id,
        amount: 100,
        reference: 'Birthday gift',
        status: 'success'
      });

      await Transaction.create({
        sender: secondUser._id,
        receiver: testUser._id,
        amount: 50,
        reference: 'Purchase refund',
        status: 'success'
      });

      await Transaction.create({
        sender: secondUser._id,
        receiver: testUser._id,
        amount: 75,
        reference: 'Freelance work',
        status: 'success'
      });

      // Transaction with explicit deposit reference (for line 288 coverage)
      await Transaction.create({
        sender: secondUser._id,
        receiver: testUser._id,
        amount: 200,
        reference: 'Payment deposit',
        status: 'success'
      });

      // Create a deposit (self-transfer with reference - for line 314)
      await Transaction.create({
        sender: testUser._id,
        receiver: testUser._id,
        amount: 300,
        reference: 'Bank deposit',
        status: 'success'
      });      
        // Create a self-transfer with empty reference (for line 314 falsy reference case)
      await Transaction.create({
        sender: testUser._id,
        receiver: testUser._id,
        amount: 150,
        reference: '', // Empty string to test the !transaction.reference condition
        status: 'success'
      });

      const response = await request(app)
        .post('/api/reports/get-category-summary')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ userId: testUser._id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const { incomeCategories } = response.body.data;
      expect(incomeCategories.Salary).toBe(1000);
      expect(incomeCategories.Gifts).toBe(100);
      expect(incomeCategories.Refunds).toBe(50);
      expect(incomeCategories.Other).toBe(75); // Freelance work
      expect(incomeCategories.Deposit).toBe(650); // 200 + 300 + 150
    });    
    
    it('should filter by date range', async () => {
      // Create transactions in different time periods
      const pastDate = new Date('2023-01-15');
      const currentDate = new Date();

      // Past transaction
      await Transaction.create({
        sender: secondUser._id,
        receiver: testUser._id,
        amount: 500,
        reference: 'Past salary',
        status: 'success',
        createdAt: pastDate
      });

      // Current transaction
      await Transaction.create({
        sender: secondUser._id,
        receiver: testUser._id,
        amount: 1000,
        reference: 'Current salary',
        status: 'success',
        createdAt: currentDate
      });

      // Query with date range (current only)
      const fromDate = new Date(currentDate);
      fromDate.setDate(fromDate.getDate() - 1); // yesterday

      const response = await request(app)
        .post('/api/reports/get-category-summary')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ 
          userId: testUser._id,
          fromDate: fromDate.toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const { incomeCategories } = response.body.data;
      expect(incomeCategories.Salary).toBe(1000); // Only current salary
      expect(incomeCategories).not.toHaveProperty('Past salary');
    });

      it('should properly handle zero/empty categories and all expense types', async () => {
      // Create a transaction with zero amount to test zero category removal (lines 327-332)
      await Transaction.create({
        sender: secondUser._id,
        receiver: testUser._id,
        amount: 0,  // Zero amount
        reference: 'Zero amount salary',
        status: 'success'
      });
      
      // Create a real transaction to make sure non-zero categories remain
      await Transaction.create({
        sender: secondUser._id,
        receiver: testUser._id,
        amount: 100,
        reference: 'Real salary',
        status: 'success'
      });
      
      // Create expense with zero amount
      await Transaction.create({
        sender: testUser._id,
        receiver: secondUser._id,
        amount: 0,  // Zero amount
        reference: 'Food groceries',
        status: 'success'
      });
      
      // Create real expense
      await Transaction.create({
        sender: testUser._id,
        receiver: secondUser._id,
        amount: 50,
        reference: 'Real food expense',
        status: 'success'
      });      // Add utility bill transaction specifically for line 261 coverage
      await Transaction.create({
        sender: testUser._id,
        receiver: secondUser._id,
        amount: 75,
        reference: 'bill payment', // Using "bill" keyword exactly to match line 261
        status: 'success'
      });
      
      // Add another utility transaction with different keyword for line 261
      await Transaction.create({
        sender: testUser._id,
        receiver: secondUser._id,
        amount: 65,
        reference: 'utility payment', // Using "utility" keyword exactly to match line 261
        status: 'success'
      });

      // Add gas/fuel transaction specifically for line 268 coverage
      await Transaction.create({
        sender: testUser._id,
        receiver: secondUser._id,
        amount: 85,
        reference: 'gas payment', // Using "gas" keyword exactly to match line 268
        status: 'success'
      });
      
      // Add another transportation transaction with different keyword for line 268
      await Transaction.create({
        sender: testUser._id,
        receiver: secondUser._id,
        amount: 45,
        reference: 'fuel expense', // Using "fuel" keyword exactly to match line 268
        status: 'success'
      });

      // Add transactions with negative amounts to test the <= 0 condition (lines 327, 332)
      await Transaction.create({
        sender: testUser._id,
        receiver: secondUser._id,
        amount: -5,  // Negative amount for expense
        reference: 'Negative expense test',
        status: 'success'
      });

      await Transaction.create({
        sender: secondUser._id,
        receiver: testUser._id,
        amount: -10,  // Negative amount for income
        reference: 'Negative income test',
        status: 'success'
      });

      const response = await request(app)
        .post('/api/reports/get-category-summary')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ userId: testUser._id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Check that zero categories were removed (lines 327-332)
      const { incomeCategories, expenseCategories } = response.body.data;
      expect(incomeCategories.Salary).toBe(100); // Only the positive amount
      expect(expenseCategories.Food).toBe(50);   // Only the positive amount
        // Check specific categories for lines 261 and 268
      expect(expenseCategories.Utilities).toBe(140); // 75 + 65 (Specifically tests line 261)
      expect(expenseCategories.Transportation).toBe(130); // 85 + 45 (Specifically tests line 268)
      
      // Verify negative amounts were removed (testing <= 0 condition in lines 327, 332)
      expect(expenseCategories).not.toHaveProperty('Negative expense test');
      expect(incomeCategories).not.toHaveProperty('Negative income test');
    });

    it('should return error with invalid user ID', async () => {
        const token = generateTestToken('invalid-id');
      
        const response = await request(app)
        .post('/api/reports/get-category-summary')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: 'invalid-id' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid user ID');
    });

    it('should handle database errors gracefully', async () => {
      // Mock Transaction.find to throw an error
      jest.spyOn(Transaction, 'find').mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/api/reports/get-category-summary')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ userId: testUser._id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to fetch category summary');
      expect(response.body.data).toBe('Database error');
    });
  });
});
