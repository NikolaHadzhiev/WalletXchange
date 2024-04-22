const router = require("express").Router();
const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middlewares/authMiddleware");

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

    // generate token
    const token = jwt.sign({ userId: user._id }, process.env.jwt_secret, {
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
router.post("/get-user-info", authMiddleware, async (req, res) => {
  try {

    const user = await User.findById(req.body.userId);

    user.password = ""; //The password should not be accessed by front end

    res.send({
      message: "User info fetched successfully",
      data: user,
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
