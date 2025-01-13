const router = require("express").Router();
const User = require("../models/userModel");
const DeletedUser = require("../models/deletedUserModel");
const Transaction = require("../models/transactionModel");
const Request = require("../models/requestsModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { authenticationMiddleware, authorizationMiddleware } = require("../middlewares/authMiddleware");
const speakeasy = require('speakeasy');

// register user account
router.post("/register", async (req, res) => {
  try {

    // check if user provided correct confirmPassword
    if (req.body.password !== req.body.confirmPassword) {
      return res.send({
        success: false,
        message: "Password and Confirm password does not match",
      });
    }

    // check if user already exists
    let user = await User.findOne({ email: req.body.email });

    if (user) {
      return res.send({
        success: false,
        message: "User already exists",
      });
    }

    // hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    req.body.password = hashedPassword;

    const newUser = new User(req.body);
    await newUser.save();

    res.send({
      message: "User created successfully",
      data: null,
      success: true,
    });
  } catch (error) {
    res.send({
      message: error.message,
      success: false,
    });
  }
});

// login user account

router.post("/login", async (req, res) => {
  try {
    // check if user exists
    let user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.send({
        success: false,
        message: "User does not exist",
      });
    }

    // check if password is correct
    const validPassword = await bcrypt.compare(
      req.body.password,
      user.password
    );

    if (!validPassword) {
      return res.send({
        success: false,
        message: "Invalid password",
      });
    }

    //check if user is verified
    if (!user.isVerified) {
      return res.send({
        success: false,
        message: "User is not verified yet or has been suspended",
      });
    }

    if (user.twoFactorEnabled) {
      return res.send({
        message: 'Two-factor authentication required',
        userId: user._id,
        twoFA: true,
        success: true,
      });
    }

    // generate token
    const token = jwt.sign({ userId: user._id, isAdmin: user.isAdmin }, process.env.jwt_secret, {
      expiresIn: "1d",
    });

    res.send({
      message: "User logged in successfully",
      data: token,
      success: true,
    });
  } catch (error) {
    res.send({
      message: error.message,
      success: false,
    });
  }
});

// get user info
router.post("/get-user-info", authenticationMiddleware, async (req, res) => {
  try {

    const user = await User.findById(req.body.userId);

    if (user) {
      user.password = ""; //The password should not be accessed by front end

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
router.post("/request-delete", authenticationMiddleware, authorizationMiddleware, async (req, res) => {
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


router.post('/verify-2fa', async (req, res) => {
  try {
    const user = await User.findById(req.body.userId);
    if (!user || !user.twoFactorEnabled) {
      return res.status(400).send({
        message: 'Two-factor authentication is not enabled for this user',
        success: false,
      });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: req.body.token,
    });

    if (!verified) {
      return res.status(400).send({
        message: 'Invalid 2FA token',
        success: false,
      });
    }

    // generate token
    const token = jwt.sign({ userId: user._id, isAdmin: user.isAdmin }, process.env.jwt_secret, {
      expiresIn: "1d",
    });

    res.send({
      message: 'Two-factor authentication successful. User logged in successfully',
      token: token,
      success: true,
    });
  } catch (error) {
    res.send({
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
