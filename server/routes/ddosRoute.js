const router = require("express").Router();
const LoginAttempt = require("../models/loginAttemptModel"); // Import loginAttempt model

// Check if the IP is blocked or rate-limited
router.get("/ddos-check", async (req, res) => {
  try {
    // Find the login attempt record for the current IP address
    const loginAttempt = await LoginAttempt.findOne({ identifier: req.ip });

    // Check if there's a lockout (timeoutUntil field is not null and current time is less than the lockout time)
    if (loginAttempt && loginAttempt.timeoutUntil && new Date() < loginAttempt.timeoutUntil) {
      return res.status(429).send({
        message: "Your IP is temporarily blocked due to Too many requests. Please try again later.",
        success: false,
        timeoutUntil: loginAttempt.timeoutUntil,
      });
    }

    // Check the failed attempt count
    if (loginAttempt && loginAttempt.attempts >= 10) {
      return res.status(429).send({
        message: "Too many requests. Please wait and try again later.",
        success: false,
        count: loginAttempt.attempts,
      });
    }

    // If no issues, return success status
    res.status(200).send({
      message: "You are not blocked. You can make requests.",
      success: true,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      message: "Server error",
      success: false,
    });
  }
});

module.exports = router;
