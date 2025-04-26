// This script creates the load test users in the database
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({
  path: '.env.development',
});
const User = require('../../models/userModel');

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
    isVerified: true,
    isAdmin: true
  },  {
    _id: '680cd31b631e084fcb6c6842', // Fixed to match k6 test - needs to be 24 chars
    email: 'walletxchangeloadtestus2@gmail.com',
    password: 'loadTest2',
    firstName: 'LoadTest',
    lastName: 'User2',
    phoneNumber: '0987654321',
    address: '456 Load Test St',
    identificationType: 'PASSPORT',
    identificationNumber: 'LOADTEST2',
    balance: 5000,
    isVerified: true,
    isAdmin: true
  }
];

// Connect to the database
async function connectDB() {
  try {
    await mongoose.connect(process.env.mongo_url);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
}

// Create load test users
async function createLoadTestUsers() {
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
        _id: new mongoose.Types.ObjectId(userData._id),
        password: hashedPassword
      });
      
      console.log(`Created load test user: ${userData.email}`);
    }
    
    console.log('Load test users setup completed');
  } catch (error) {
    console.error('Error setting up load test users:', error);
  }
}

// Create load test users and disconnect
connectDB()
  .then(async () => {
    await createLoadTestUsers();
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  })
  .catch(error => {
    console.error('Error:', error);
    mongoose.disconnect();
  });
