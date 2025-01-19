const router = require("express").Router();
const User = require("../models/userModel");
const DeletedUser = require("../models/deletedUserModel");
const Transaction = require("../models/transactionModel");
const Request = require("../models/requestsModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { authenticationMiddleware, authorizationMiddleware } = require("../middlewares/authMiddleware");
const { loginRateLimiter } = require("../middlewares/failedLoginTimeoutMiddleware");
const speakeasy = require('speakeasy');
const { body, validationResult } = require("express-validator");
const DOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");

// DOMPurify setup for server-side sanitization
const window = new JSDOM("").window;
const purify = DOMPurify(window);

// register user account
router.post(
  "/register",
  [
    // Validation and sanitization middleware
    body("firstName")
      .matches(/^[A-Za-z\s]{1,50}$/)
      .withMessage("First name must be 1-50 letters only")
      .customSanitizer((value) => purify.sanitize(value.trim())),
    body("lastName")
      .matches(/^[A-Za-z\s]{1,50}$/)
      .withMessage("Last name must be 1-50 letters only")
      .customSanitizer((value) => purify.sanitize(value.trim())),
    body("email")
      .isEmail()
      .withMessage("Invalid email format")
      .normalizeEmail()
      .customSanitizer((value) => purify.sanitize(value)),
    body("phoneNumber")
      .matches(/^\d{10,15}$/)
      .withMessage("Phone number must be 10-15 digits")
      .customSanitizer((value) => purify.sanitize(value.trim())),
    body("address")
      .matches(/^[A-Za-z0-9\s,.'-]{1,100}$/)
      .withMessage("Address must be 1-100 characters long")
      .customSanitizer((value) => purify.sanitize(value.trim())),
    body("identificationType")
      .isIn([
        "NATIONAL ID",
        "PASSPORT",
        "DRIVING LICENSE",
        "SOCIAL CARD",
      ])
      .withMessage("Invalid identification type")
      .customSanitizer((value) => purify.sanitize(value)),
    body("identificationNumber")
      .matches(/^[A-Za-z0-9]{1,20}$/)
      .withMessage("Identification number must be 1-20 alphanumeric characters")
      .customSanitizer((value) => purify.sanitize(value.trim())),
    body("password")
      .matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/)
      .withMessage(
        "Password must be at least 8 characters long and include letters and numbers"
      ),
    body("confirmPassword")
      .custom((value, { req }) => value === req.body.password)
      .withMessage("Password and Confirm Password do not match"),
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).send({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      // Check if user already exists
      const user = await User.findOne({ email: req.body.email });
      if (user) {
        return res.status(400).send({
          success: false,
          message: "User already exists",
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(req.body.password, salt);

      // Create new user
      const newUser = new User({
        firstName: purify.sanitize(req.body.firstName),
        lastName: purify.sanitize(req.body.lastName),
        email: purify.sanitize(req.body.email),
        phoneNumber: purify.sanitize(req.body.phoneNumber),
        address: purify.sanitize(req.body.address),
        identificationType: purify.sanitize(req.body.identificationType),
        identificationNumber: purify.sanitize(req.body.identificationNumber),
        password: hashedPassword,
      });

      await newUser.save();

      res.send({
        message: "User created successfully",
        data: null,
        success: true,
      });
    } catch (error) {
      res.status(500).send({
        message: error.message,
        success: false,
      });
    }
  }
);

// login user account
router.post(
  "/login",
  [
    // Validate and sanitize email
    body("email").isEmail().withMessage("Invalid email format").trim().escape(),
    // Sanitize password (escape to remove malicious characters)
    body("password").notEmpty().withMessage("Password is required").escape(),
  ],
  loginRateLimiter,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).send({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        await req.incrementAttempts();
        return res.status(401).send({
          success: false,
          message: "User does not exist.",
        });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        await req.incrementAttempts();
        return res.status(401).send({
          success: false,
          message: "Invalid password. Please try again.",
        });
      }

      await req.resetAttempts(); // Reset attempts on successful login

      if (!user.isVerified) {
        return res.status(403).send({
          success: false,
          message: "User is not verified or has been suspended.",
        });
      }

      if (user.twoFactorEnabled) {
        return res.send({
          message: "Two-factor authentication required",
          userId: user._id,
          twoFA: true,
          success: true,
        });
      }

      // Generate access token
      const token = jwt.sign(
        { userId: user._id, isAdmin: user.isAdmin },
        process.env.jwt_secret,
        { expiresIn: "1h" }
      );

      // Generate refresh token
      const refreshToken = jwt.sign(
        { userId: user._id, isAdmin: user.isAdmin },
        process.env.refresh_token_secret,
        { expiresIn: "7d" }
      );

      // Save the refresh token in a secure, HTTP-only cookie
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: false, // Ensure it's secure in production
        sameSite: "Lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.send({
        message: "User logged in successfully.",
        data: token,
        success: true,
      });
    } catch (error) {
      res.status(500).send({
        message: error.message,
        success: false,
      });
    }
  }
);

router.post("/refresh-token", async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken; // Get token from cookies

    if (!refreshToken) {
      return res.status(403).send({
        success: false,
        message: "Refresh token not found.",
      });
    }

    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.refresh_token_secret);

    // Generate a new access token
    const newAccessToken = jwt.sign(
      { userId: decoded.userId, isAdmin: decoded.isAdmin },
      process.env.jwt_secret,
      { expiresIn: "1h" }
    );

    res.send({
      message: "Session refreshed successfully.",
      data: newAccessToken,
      success: true,
    });
  } catch (error) {
    res.status(403).send({
      success: false,
      message: "Invalid or expired session.",
    });
  }
});

router.post('/logout', (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    res.clearCookie('refreshToken', { path: '/' }); // Clear the cookie
  }

  res.send({ success: true, message: 'Logged out successfully' });
});

// get user info
router.post("/get-user-info", authenticationMiddleware, async (req, res) => {
  try {

    const user = await User.findById(req.body.userId).select("-password"); // Exclude password field

    if (user) {
      res.send({
        message: "User info fetched successfully",
        data: user,
        success: true,
      });

      return;

    }
    else {
      res.send({
        message: "User deleted or not found",
        success: false
      });
    }

  } catch (error) {
    res.send({
      message: error.message,
      success: false,
    });
  }
});

// get all users
router.get("/get-all-users", authenticationMiddleware, authorizationMiddleware, async (req, res) => {
  try {

    const users = await User.find();

    res.send({
      message: "Users fetched successfully",
      data: users,
      success: true,
    });

  } catch (error) {
    res.send({
      message: error.message,
      success: false,
    });
  }
});

// update user verified status
router.post("/update-user-verified-status", authenticationMiddleware, authorizationMiddleware, async (req, res) => {
  try {

    await User.findByIdAndUpdate(req.body.selectedUser, {
      isVerified: req.body.isVerified,
    });

    res.send({
      data: null,
      message: "User verified status updated successfully",
      success: true,
    });

  } 
  catch (error) {
    res.send({
      data: error,
      message: error.message,
      success: false,
    });
  }
});

// update user request delete
router.post("/request-delete", authenticationMiddleware, async (req, res) => {
  try {

    await User.findByIdAndUpdate(req.body._id, {
      requestDelete: req.body.requestDelete,
    });

    res.send({
      data: null,
      message: "User delete status updated successfully",
      success: true,
    });

  } 
  catch (error) {
    res.send({
      data: error,
      message: error.message,
      success: false,
    });
  }
});

// delete user
router.delete("/delete-user/:id", authenticationMiddleware, authorizationMiddleware, async (req, res) => {
  try {

    const userToDelete = await User.findById(req.params.id);

    const requests = await Request.find({
      $or: [{ sender: userToDelete._id }, { receiver: userToDelete._id }],
    })

    const transactions = await Transaction.find({
      $or: [{ sender: userToDelete._id }, { receiver: userToDelete._id }],
    })

    if (userToDelete) {

      await DeletedUser.create({ deleteId: userToDelete._id, firstName: userToDelete.firstName, lastName: userToDelete.lastName, requests, transactions});
      await User.findByIdAndDelete(req.params.id);

      res.send({
        data: null,
        message: "User deleted successfully",
        success: true,
      });

      return;
    }

    res.send({
      data: null,
      message: "User not found",
      success: false,
    });

  } 
  catch (error) {
    res.send({
      data: error,
      message: error.message,
      success: false,
    });
  }
});

router.post('/enable-2fa', authenticationMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.body.userId);

    if (!user) {
      return res.status(404).send({
        message: 'User not found',
        success: false,
      });
    }

     // Check if 2FA is already enabled
     if (user.twoFactorEnabled) {
      return res.status(400).send({
        message: 'Two-factor authentication is already enabled for this user',
        success: false,
      });
    }

    const secret = speakeasy.generateSecret({ length: 20 });
    
    // Set the label as WalletXChange:{email}
    const label = `WalletXChange: ${user.email}`;
    const issuer = 'WalletXChange'; // Group entries under this name

    // Manually construct the otpauth URL
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(label)}?secret=${secret.base32}&issuer=${encodeURIComponent(issuer)}`;

    user.twoFactorSecret = secret.base32;
    user.twoFactorEnabled = true;
    await user.save();

    res.send({
      message: 'Two-factor authentication enabled successfully',
      data: {
        otpauthUrl, // Use the custom otpauth URL
      },
      success: true,
    });
  } catch (error) {
    res.send({
      message: error.message,
      success: false,
    });
  }
});

router.post('/check-2fa', async (req, res) => {
  try {
    const user = await User.findById(req.body.userId);
    if (!user || !user.twoFactorEnabled) {
      return res.status(200).send({
        message: 'Two-factor authentication is not enabled for this user',
        success: true,
        isEnabled: false
      });
    }

    res.status(400).send({
      message: 'Two-Factor Authentication is already enabled.',
      success: true,
      isEnabled: true
    });
  } catch (error) {
    res.send({
      message: error.message,
      success: false,
    });
  }
});

router.post("/verify-2fa", async (req, res) => {
  try {
    // Sanitize token input
    const tokenInput = purify.sanitize(req.body.token);

    // Fetch user and validate 2FA status
    const user = await User.findById(req.body.userId);
    if (!user || !user.twoFactorEnabled) {
      return res.status(400).send({
        message: "Two-factor authentication is not enabled for this user",
        success: false,
      });
    }

    // Verify the sanitized token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: tokenInput,
    });

    if (!verified) {
      return res.status(400).send({
        message: "Invalid 2FA token",
        success: false,
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, isAdmin: user.isAdmin },
      process.env.jwt_secret,
      { expiresIn: "1d" }
    );

    res.send({
      message: "Two-factor authentication successful. User logged in successfully",
      token: token,
      success: true,
    });
  } catch (error) {
    res.status(500).send({
      message: error.message,
      success: false,
    });
  }
});

router.post('/disable-2fa', authenticationMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.body.userId);

    if (!user || !user.twoFactorEnabled) {
      return res.status(400).send({
        message: 'Two-factor authentication is not enabled for this user',
        success: false,
      });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    await user.save();

    res.send({
      message: 'Two-factor authentication disabled successfully',
      success: true,
    });
  } catch (error) {
    res.send({
      message: error.message,
      success: false,
    });
  }
});

module.exports = router;
