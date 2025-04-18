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

// Helper function to generate test tokens
const generateTestToken = (userId, isAdmin = false) => {
  return jwt.sign(
    { userId, isAdmin },
    process.env.jwt_secret,
    { expiresIn: '1h' }
  );
};

module.exports = {
  generateTestToken
};
