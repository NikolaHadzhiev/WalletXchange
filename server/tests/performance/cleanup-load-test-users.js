// This script removes load test users from the database
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const User = require('../../models/userModel');
const Transaction = require('../../models/transactionModel');
const Request = require('../../models/requestsModel');
const DeletedUser = require('../../models/deletedUserModel');
require('dotenv').config({
  path: '.env.development',
});

// Load test user IDs - these should match the ones in api-load.test.k6.js
const LOAD_TEST_USER_IDS = [
  '680cd20f631e084fcb6c683d', // USER_1 - expected 24-character ObjectId
  '680cd31b631e084fcb6c6842'  // USER_2 - corrected to 24-character format
];

// Load test user emails - for cleaning up any dynamically registered users
const LOAD_TEST_USER_EMAILS = [
  'walletxchangeloadtestus1@gmail.com',
  'walletxchangeloadtestus2@gmail.com'
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

// Delete load test users and their related data
async function cleanupLoadTestUsers() {
  try {
    console.log('Starting cleanup of load test users...');
    
    // Find all users with emails containing 'loadtest'
    const dynamicTestUsers = await User.find({
      $or: [
        { email: { $in: LOAD_TEST_USER_EMAILS } },
        { email: { $regex: /loadtest/i } }
      ]
    });      // Convert string IDs to ObjectId instances with validation
    const validObjectIds = [];
    const validObjectIdStrings = [];
      // Debug info
    console.log('Attempting to cleanup the following IDs:');
    for (const id of LOAD_TEST_USER_IDS) {
      console.log(`  - ${id} (${id.length} chars, valid: ${mongoose.Types.ObjectId.isValid(id)})`);
    }
    
    // Validate and convert predefined test user IDs
    for (const id of LOAD_TEST_USER_IDS) {
      try {
        if (mongoose.Types.ObjectId.isValid(id)) {
          const objectId = new ObjectId(id);
          validObjectIds.push(objectId);
          validObjectIdStrings.push(id);
          console.log(`Successfully converted ${id} to ObjectId: ${objectId}`);
        } else {
          console.warn(`Skipping invalid ObjectId: ${id}`);
        }
      } catch (err) {
        console.warn(`Error converting ${id} to ObjectId: ${err.message}`);
      }
    }
    
    // Add dynamic user IDs that are already valid ObjectIds
    const dynamicIds = dynamicTestUsers.map(user => user._id);
    const dynamicIdStrings = dynamicTestUsers.map(user => user._id.toString());
    
    const allUserIds = [...validObjectIds, ...dynamicIds];
    const userIdStrings = [...validObjectIdStrings, ...dynamicIdStrings];
    
    console.log(`Found ${dynamicTestUsers.length} dynamic test users`);
    console.log(`Total users to delete: ${allUserIds.length}`);
      try {
      // Delete transactions related to test users
      // Fallback to email-based deletion if ObjectId approach fails
      try {
        const deletedTransactions = await Transaction.deleteMany({
          $or: [
            { sender: { $in: allUserIds } },
            { receiver: { $in: allUserIds } }
          ]
        });
        console.log(`Deleted ${deletedTransactions.deletedCount} transactions by ID`);
      } catch (idError) {
        console.error('Error deleting transactions by ID, trying by email lookup:', idError.message);
        
        // Find users by email first, then use their IDs
        const testUsers = await User.find({
          email: { $in: LOAD_TEST_USER_EMAILS }
        });
        
        if (testUsers.length > 0) {
          const userIds = testUsers.map(user => user._id);
          const emailDeletedTransactions = await Transaction.deleteMany({
            $or: [
              { sender: { $in: userIds } },
              { receiver: { $in: userIds } }
            ]
          });
          console.log(`Deleted ${emailDeletedTransactions.deletedCount} transactions by user email lookup`);
        }
      }
    } catch (error) {
      console.error('Error deleting transactions:', error.message);
    }
      try {
      // Delete requests related to test users
      // Fallback to email-based deletion if ObjectId approach fails
      try {
        const deletedRequests = await Request.deleteMany({
          $or: [
            { sender: { $in: allUserIds } },
            { receiver: { $in: allUserIds } }
          ]
        });
        console.log(`Deleted ${deletedRequests.deletedCount} requests by ID`);
      } catch (idError) {
        console.error('Error deleting requests by ID, trying by email lookup:', idError.message);
        
        // Find users by email first, then use their IDs
        const testUsers = await User.find({
          email: { $in: LOAD_TEST_USER_EMAILS }
        });
        
        if (testUsers.length > 0) {
          const userIds = testUsers.map(user => user._id);
          const emailDeletedRequests = await Request.deleteMany({
            $or: [
              { sender: { $in: userIds } },
              { receiver: { $in: userIds } }
            ]
          });
          console.log(`Deleted ${emailDeletedRequests.deletedCount} requests by user email lookup`);
        }
      }
    } catch (error) {
      console.error('Error deleting requests:', error.message);
    }
      try {
      // Delete any entries in DeletedUser collection
      const deletedUserRecords = await DeletedUser.deleteMany({
        deleteId: { $in: allUserIds }
      });
      console.log(`Deleted ${deletedUserRecords.deletedCount} deleted user records`);
    } catch (error) {
      console.error('Error deleting user records:', error.message);
    }
      try {
      // First attempt: Delete by IDs and emails combined
      const deletedUsers = await User.deleteMany({
        $or: [
          { _id: { $in: allUserIds } },
          { email: { $in: LOAD_TEST_USER_EMAILS } },
          { email: { $regex: /loadtest/i } }
        ]
      });
      console.log(`Deleted ${deletedUsers.deletedCount} user records`);
      
      // Second attempt: Just in case, also try to delete each load test user individually by email
      for (const email of LOAD_TEST_USER_EMAILS) {
        try {
          // Find and delete specific test users by email to ensure they're removed
          const user = await User.findOne({ email });
          if (user) {
            await User.deleteOne({ _id: user._id });
            console.log(`Successfully deleted user with email: ${email}`);
            
            // Also delete any associated transactions and requests 
            if (user._id) {
              await Transaction.deleteMany({
                $or: [
                  { sender: user._id },
                  { receiver: user._id }
                ]
              });
              await Request.deleteMany({
                $or: [
                  { sender: user._id },
                  { receiver: user._id }
                ]
              });
              console.log(`Cleaned up related records for user: ${email}`);
            }
          } else {
            console.log(`User with email ${email} not found - already deleted`);
          }
        } catch (individualError) {
          console.error(`Error deleting individual user with email ${email}:`, individualError.message);
        }
      }
    } catch (error) {
      console.error('Error deleting users:', error.message);
    }
    
    console.log('Cleanup completed successfully');
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the cleanup
connectDB()
  .then(cleanupLoadTestUsers)
  .catch(console.error);
