const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis'); 
const { createClient } = require('redis');
const LoginAttempt = require('../models/loginAttemptModel');

// Create Redis client
const redisClient = createClient({
    socket: {
      host: 'localhost',  // Or Redis server address
      port: 6379,         // Redis default port
    }
  });

  redisClient.connect().then(() => {
    console.log('Connected to Redis');
  }).catch(err => {
    console.error('Redis connection error:', err);
  });

const BLOCK_DURATION = 1 * 60 * 1000; // Block duration in milliseconds (1 minute)

// Rate limiter using Redis to store request counts
const limiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    expiry: 60 * 15,  // Store request counts for 15 minutes
  }),
  windowMs: 60 * 1000,  // 1 minute window
  max: 100,              // Limit each IP to 100 requests per minute
  message: 'Too many requests from this IP, please try again later.',
  handler: async (req, res, next, options) => {
    const identifier = req.ip; // Or use email, depending on your use case
    const currentTime = Date.now();

    try {
      // Check if the IP is already blocked in the DB
      const ddosAttempt = await LoginAttempt.findOne({ identifier });

      if (ddosAttempt && ddosAttempt.timeoutUntil && ddosAttempt.timeoutUntil > currentTime) {
        // The IP is already blocked
        console.log(`IP ${identifier} is already blocked until ${ddosAttempt.timeoutUntil}`);
        return res.status(429).send({
          success: false,
          message: `IP ${identifier} is already blocked until ${ddosAttempt.timeoutUntil}`,
          timeoutUntil,
        });;
      }

      // If the IP is not blocked, update the attempt count and set a timeout
      if (!ddosAttempt) {
        await LoginAttempt.create({
          identifier,
          blockedCount: 1,
          timeoutUntil: currentTime + BLOCK_DURATION,
          lastAttempt: currentTime,
        });
      } else {
        await LoginAttempt.updateOne(
          { identifier },
          {
            $set: {
              blockedCount: attempt.blockedCount + 1,
              timeoutUntil: currentTime + BLOCK_DURATION,
              lastAttempt: currentTime,
            },
          }
        );
      }

      console.log(`Rate limit reached for ${identifier}, blocking for 1 minute`);
      return res.status(429).send({
        success: false,
        message: `IP ${identifier} is blocked until ${currentTime + BLOCK_DURATION} due to too many requests`,
      });
    } catch (error) {
      console.error('Error updating login attempts:', error);
    }
  },
});

// Middleware to check if IP is blocked
const checkBlockedIP = async (req, res, next) => {
  const identifier = req.ip || req.body.email; // Or use email, depending on your use case
  const currentTime = Date.now();

  try {
    // Find login attempt record for the identifier (IP or email)
    const loginAttempt = await LoginAttempt.findOne({ identifier });

    // If the IP is found and still blocked
    if (loginAttempt && loginAttempt.timeoutUntil > currentTime) {
      return res.status(429).send({
        success: false,
        message: `Your IP is blocked due to Too many requests. Please try again later.`,
      });
    }

    next(); // Continue to the next middleware if not blocked
  } catch (error) {
    console.error('Error checking blocked IP:', error);
    next(); // Continue with request processing even if there's an error (optional)
  }
};

// Combine rate limiting and IP blocking
const ddosProtection = async (req, res, next) => {
  try {
    // First check if the IP is blocked
    await checkBlockedIP(req, res, () => {
      // Apply rate limiting
      limiter(req, res, next);
    });
  } catch (error) {
    console.error('Error in ddosProtection middleware:', error);
    res.status(500).send('Internal server error');
  }
};

module.exports = ddosProtection;
