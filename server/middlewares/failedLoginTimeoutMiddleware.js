const LoginAttempt = require('../models/loginAttemptModel');

module.exports.loginRateLimiter = async function (req, res, next) {
  const MAX_ATTEMPTS = 5;
  const TIMEOUT = 1 * 60 * 1000; // 1 minutes
  const now = new Date();
  const identifier = req.body.email || req.ip; // Use email or IP

  try {
    // Fetch or create login attempt record
    let loginAttempt = await LoginAttempt.findOne({ identifier });

    if (!loginAttempt) {
      loginAttempt = await LoginAttempt.create({ identifier });
    }

    // Check if user is locked out
    if (loginAttempt.timeoutUntil && loginAttempt.timeoutUntil > now) {
      const remainingTime = Math.ceil((loginAttempt.timeoutUntil - now) / 1000);
      return res.status(429).send({
        success: false,
        message: `Too many incorrect attempts. Retry in ${remainingTime} seconds.`,
        remainingTime,
      });
    }

    // Attach helpers to the request
    req.incrementAttempts = async () => {
      loginAttempt.attempt += 1;
      if (loginAttempt.attempt >= MAX_ATTEMPTS) {
        loginAttempt.timeoutUntil = new Date(now.getTime() + TIMEOUT);
        loginAttempt.attempt = 0; // Reset count after lockout
        loginAttempt.blockedCount += 1;
      }
      loginAttempt.lastAttempt = now;
      await loginAttempt.save();
    };

    req.resetAttempts = async () => {
      await LoginAttempt.deleteOne({ identifier });
    };

    next();
  } catch (error) {
    console.error('Error in loginRateLimiter:', error);
    res.status(500).send({
      success: false,
      message: 'Internal server error.',
    });
  }
};
