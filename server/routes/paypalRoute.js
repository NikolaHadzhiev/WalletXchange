const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Transaction = require("../models/transactionModel");
const { authenticationMiddleware } = require("../middlewares/authMiddleware");
const User = require("../models/userModel");
const DepositCode = require("../models/depositCodeModel");
const nodemailer = require("nodemailer");
const DOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const purify = DOMPurify(window);

// PayPal SDK setup
const paypal = require('@paypal/checkout-server-sdk');
const paypalClient = new paypal.core.PayPalHttpClient(
  new paypal.core.SandboxEnvironment(
    process.env.paypal_client_id,
    process.env.paypal_client_secret
  )
);

// Helper: create nodemailer transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.email_host,
    port: process.env.email_port,
    secure: true,
    auth: {
      user: process.env.email_username,
      pass: process.env.email_password,
    },
  });
};

// Helper: send email
const sendTransactionEmail = async (email, subject, message) => {
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.email_username,
      to: email,
      subject: subject,
      text: message,
    });
    return true;
  } catch (error) {
    console.error("Email sending failed:", error);
    return false;
  }
};

// Initiate PayPal deposit (create order only)
router.post("/create-paypal-order", authenticationMiddleware, async (req, res) => {
  try {
    const { amount, userId } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.send({ message: "Invalid amount", data: null, success: false });
    }
    if (!mongoose.isValidObjectId(userId)) {
      return res.send({ message: "Invalid user ID", data: null, success: false });
    }
    // Create PayPal order
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [{ amount: { currency_code: "USD", value: amount.toString() } }],
    });
    const order = await paypalClient.execute(request);
    
    res.send({
      success: true,
      orderID: order.result.id,
      message: "PayPal order created successfully.",
    });
  } catch (error) {
    res.send({
      message: "Error initiating PayPal deposit",
      data: purify.sanitize(error.message),
      success: false,
    });
  }
});

// Request verification code for PayPal deposit (after user has reviewed order)
router.post("/request-verification", authenticationMiddleware, async (req, res) => {
  try {
    const { userId, email, orderID } = req.body;
    
    if (!mongoose.isValidObjectId(userId)) {
      return res.send({ message: "Invalid user ID", data: null, success: false });
    }
    
    if (!email) {
      return res.send({ message: "Email is required", data: null, success: false });
    }
    
    if (!orderID) {
      return res.send({ message: "Order ID is required", data: null, success: false });
    }
    
    // Check if verification code already exists for this order
    const existingCode = await DepositCode.findOne({ stripeId: orderID });
    if (existingCode) {
      // Delete existing code if it's already there
      await DepositCode.deleteOne({ _id: existingCode._id });
    }
    
    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000);
    const expirationTime = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    
    // Save code to DB
    await DepositCode.create({
      userId,
      email,
      stripeId: orderID, // reuse field for PayPal order ID
      veritificationCode: verificationCode.toString(),
      expiresAt: expirationTime,
    });
    
    // Send code to email
    await sendTransactionEmail(
      email,
      "Deposit Verification Code for WalletXChange (PayPal)",
      `Dear user,\n\nYour verification code for confirming your PayPal deposit is: ${verificationCode}.\n\nPlease enter this code within 10 minutes to complete your deposit. If you did not request this deposit, please disregard this message.\n\nThank you for using our service!`
    );
    
    res.send({
      success: true,
      message: "Verification code sent to your email.",
    });
  } catch (error) {
    res.send({
      message: "Error sending verification code",
      data: purify.sanitize(error.message),
      success: false,
    });
  }
});

// Verify PayPal deposit code and capture payment
router.post("/verify-paypal", authenticationMiddleware, async (req, res) => {
  try {
    const { userId, verificationCode, amount, orderID } = req.body;
    
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.send({ message: "Invalid amount", data: null, success: false });
    }

    if (!mongoose.isValidObjectId(userId)) {
      return res.send({ message: "Invalid user ID", data: null, success: false });
    }

    // Find code in DB
    const codeRecord = await DepositCode.findOne({ userId, veritificationCode: verificationCode, stripeId: orderID });
    
    if (!codeRecord) {
      return res.send({ success: false, message: "Invalid or expired verification code" });
    }
    
    // Capture PayPal payment
    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});
    
    const capture = await paypalClient.execute(request);
    if (capture.result.status === "COMPLETED") {
      // Credit user and record transaction
      const newTransaction = new Transaction({
        sender: userId,
        receiver: userId,
        amount,
        type: "Deposit",
        reference: "PayPal deposit",
        status: "success",
      });

      await newTransaction.save();
      await User.findByIdAndUpdate(userId, { $inc: { balance: amount } });
      
      // Delete code after use
      await DepositCode.deleteOne({ _id: codeRecord._id });
      
      // Email notification
      const user = await User.findById(userId);
      
      if (user && user.email) {
        await sendTransactionEmail(
          user.email,
          "Deposit Successful - WalletXChange",
          `Dear ${user.firstName},\n\nYour PayPal deposit was successful.\nTransaction ID: ${newTransaction._id}\nDate: ${new Date().toLocaleString()}\n\nThank you for using WalletXChange!\n\nBest regards,\nThe WalletXChange Team`
        );
      }

      res.send({ success: true, message: "Deposit successful" });
    } else {
      res.send({ success: false, message: "PayPal payment not completed" });
    }
  } catch (error) {
    res.send({
      message: "Unpaid or invalid PayPal deposit",
      data: purify.sanitize(error.message),
      success: false,
    });
  }
});

module.exports = router;
