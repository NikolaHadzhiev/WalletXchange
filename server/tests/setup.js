const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Set default test environment variables
process.env.jwt_secret = process.env.jwt_secret || 'test-secret';
process.env.refresh_token_secret = process.env.refresh_token_secret || 'test-refresh-secret';
process.env.NODE_ENV = "development";

// Helper function to generate test tokens
const generateTestToken = (userId, isAdmin = false) => {
  return jwt.sign(
    { userId, isAdmin },
    process.env.jwt_secret,
    { expiresIn: '1h' }
  );
};

// Helper function to create load test users
const createLoadTestUsers = async () => {
  // Only create these users when explicitly running load tests
  if (process.env.SETUP_LOAD_TEST_USERS) {
    const bcrypt = require('bcryptjs');
    const User = require('../models/userModel');
    
    // Load test users from k6 script
    const LOAD_TEST_USERS = [
      {
        _id: '680cd20f631e084fcb6c683d',
        email: 'walletxchangeloadtestus1@gmail.com',
        password: 'loadTest1',
        firstName: 'LoadTest',
        lastName: 'User1',
        phoneNumber: '1234567890',
        address: '123 Load Test St',
        identificationType: 'PASSPORT',
        identificationNumber: 'LOADTEST1',
        balance: 5000,
        isVerified: true
      },
      {
        _id: '680cd31b631e084fcb6c842',
        email: 'walletxchangeloadtestus2@gmail.com',
        password: 'loadTest2',
        firstName: 'LoadTest',
        lastName: 'User2',
        phoneNumber: '0987654321',
        address: '456 Load Test St',
        identificationType: 'PASSPORT',
        identificationNumber: 'LOADTEST2',
        balance: 5000,
        isVerified: true
      }
    ];
    
    try {
      console.log('Setting up load test users...');
      
      for (const userData of LOAD_TEST_USERS) {
        // Check if user already exists
        const existingUser = await User.findOne({ email: userData.email });
        if (existingUser) {
          console.log(`Load test user ${userData.email} already exists`);
          continue;
        }
        
        // Hash password and create user
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        await User.create({
          ...userData,
          _id: mongoose.Types.ObjectId(userData._id),
          password: hashedPassword
        });
        
        console.log(`Created load test user: ${userData.email}`);
      }
      
      console.log('Load test users setup completed');
    } catch (error) {
      console.error('Error setting up load test users:', error);
    }
  }
};

module.exports = {
  generateTestToken,
  createLoadTestUsers
};
