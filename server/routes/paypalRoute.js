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
const checkoutSdk = require('@paypal/checkout-server-sdk');
const paypalClient = new checkoutSdk.core.PayPalHttpClient(
  new checkoutSdk.core.SandboxEnvironment(
    process.env.paypal_client_id,
    process.env.paypal_client_secret
  )
);

// For PayPal payouts, we need to use direct API calls since the SDK doesn't have built-in payout support
const axios = require('axios');
const paypalBaseUrl = 'https://api-m.sandbox.paypal.com';

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
    const { amount, userId, returnUrl, cancelUrl } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.send({ message: "Invalid amount", data: null, success: false });
    }
    if (!mongoose.isValidObjectId(userId)) {
      return res.send({ message: "Invalid user ID", data: null, success: false });
    }
    if (!returnUrl || !cancelUrl) {
      return res.send({ message: "Missing return or cancel URL", data: null, success: false });
    }
    // Create PayPal order
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [{ amount: { currency_code: "USD", value: amount.toString() } }],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    });
    const order = await paypalClient.execute(request);
    res.send({
      success: true,
      orderID: order.result.id,
      approvalUrl: order.result.links.find(l => l.rel === "approve")?.href,
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

// Create PayPal withdrawal (with verification)
router.post("/withdraw-paypal", authenticationMiddleware, async (req, res) => {
  try {
    const { userId, amount, paypalEmail } = req.body;
    
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.send({ message: "Invalid amount", data: null, success: false });
    }

    if (!mongoose.isValidObjectId(userId)) {
      return res.send({ message: "Invalid user ID", data: null, success: false });
    }
    
    if (!paypalEmail) {
      return res.send({ message: "PayPal email is required", data: null, success: false });
    }
    
    // Check if user has sufficient balance
    const user = await User.findById(userId);
    if (!user) {
      return res.send({ success: false, message: "User not found" });
    }
    
    if (user.balance < amount) {
      return res.send({ success: false, message: "Insufficient balance" });
    }
    
    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000);
    const expirationTime = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    
    // Save withdrawal request with code
    await DepositCode.create({
      userId,
      email: user.email,
      stripeId: `withdrawal-${Date.now()}`, // Using this field for tracking withdrawal requests
      veritificationCode: verificationCode.toString(),
      expiresAt: expirationTime,
      metadata: { paypalEmail, amount } // Store additional info for processing
    });
    
    // Send code to email
    await sendTransactionEmail(
      user.email,
      "Withdrawal Verification Code for WalletXChange (PayPal)",
      `Dear ${user.firstName},\n\nYour verification code for confirming your PayPal withdrawal of $${amount} to ${paypalEmail} is: ${verificationCode}.\n\nPlease enter this code within 10 minutes to complete your withdrawal. If you did not request this withdrawal, please disregard this message and secure your account.\n\nThank you for using our service!`
    );
    
    res.send({
      success: true,
      message: "Verification code sent to your email.",
    });
  } catch (error) {
    res.send({
      message: "Error processing withdrawal request",
      data: purify.sanitize(error.message),
      success: false,
    });
  }
});

// Verify PayPal withdrawal and process payout
router.post("/verify-withdraw-paypal", authenticationMiddleware, async (req, res) => {
  try {
    const { userId, verificationCode, amount, paypalEmail } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.send({
        message: "Invalid amount",
        data: null,
        success: false,
      });
    }

    if (!mongoose.isValidObjectId(userId)) {
      return res.send({
        message: "Invalid user ID",
        data: null,
        success: false,
      });
    }

    // Find verification code in DB
    const codeRecord = await DepositCode.findOne({
      userId,
      veritificationCode: verificationCode,
      expiresAt: { $gt: new Date() },
    });

    if (!codeRecord) {
      return res.send({
        success: false,
        message: "Invalid or expired verification code",
      });
    }

    // Verify that the amount and PayPal email match the stored data
    if (
      codeRecord.metadata &&
      (codeRecord.metadata.amount != amount ||
        codeRecord.metadata.paypalEmail !== paypalEmail)
    ) {
      return res.send({
        success: false,
        message: "Withdrawal details don't match",
      });
    }

    // Check if user has sufficient balance again
    const user = await User.findById(userId);
    if (!user) {
      return res.send({ success: false, message: "User not found" });
    }

    if (user.balance < amount) {
      return res.send({ success: false, message: "Insufficient balance" });
    }    // First get an access token for PayPal API
    let accessToken;
    try {
      const tokenResponse = await axios({
        method: 'post',
        url: `${paypalBaseUrl}/v1/oauth2/token`,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        auth: {
          username: process.env.paypal_client_id,
          password: process.env.paypal_client_secret
        },
        data: 'grant_type=client_credentials'
      });
      
      accessToken = tokenResponse.data.access_token;
    } catch (tokenError) {
      return res.send({
        success: false,
        message: "Failed to authenticate with PayPal. Please try again later.",
      });
    }
    
    // Create PayPal payout using direct API call
    const payoutData = {
      sender_batch_header: {
        sender_batch_id: `WalletXchange_${Date.now()}`,
        email_subject: "You have a payout from WalletXchange",
        email_message: "Your withdrawal from WalletXchange has been processed and sent to your PayPal account."
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: {
            value: amount.toString(),
            currency: "USD"
          },
          note: "Withdrawal from WalletXchange",
          receiver: paypalEmail,
          sender_item_id: `withdrawal_${Date.now()}_${userId}`
        }
      ]
    };

    let payoutResult;
    try {
      // Execute the PayPal payout
      const payoutResponse = await axios({
        method: 'post',
        url: `${paypalBaseUrl}/v1/payments/payouts`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        data: payoutData
      });
      
      payoutResult = payoutResponse.data;
      
      // Check if the payout was created successfully
      if (!payoutResult || !payoutResult.batch_header || payoutResult.batch_header.batch_status !== "PENDING") {
        return res.send({
          success: false,
          message: "Failed to process PayPal withdrawal. Please try again later."
        });
      }
    } catch (payoutError) {
      return res.send({
        success: false,
        message: `Failed to process PayPal withdrawal: ${payoutError.response?.data?.message || 'Unknown error'}`,
      });
    }
    
    // Store the payout batch ID for reference
    const payoutBatchId = payoutResult.batch_header.payout_batch_id;

    // Process user's account and create transaction record
    // Debit user's balance
    await User.findByIdAndUpdate(userId, { $inc: { balance: -amount } });

    // Record transaction
    const newTransaction = new Transaction({
      sender: userId,
      receiver: userId,
      amount,
      type: "Withdrawal",
      reference: `PayPal withdrawal to ${paypalEmail} (Payout ID: ${payoutBatchId})`,
      status: "success",
    });
    await newTransaction.save();

    // Delete verification code after use
    await DepositCode.deleteOne({ _id: codeRecord._id });

    // Send confirmation email
    await sendTransactionEmail(
      user.email,
      "Withdrawal Successful - WalletXChange",
      `Dear ${
        user.firstName
      },\n\nYour PayPal withdrawal of $${amount} to ${paypalEmail} was successfully processed.\nTransaction ID: ${
        newTransaction._id
      }\nPayout ID: ${payoutBatchId}\nDate: ${new Date().toLocaleString()}\n\nThank you for using WalletXChange!\n\nBest regards,\nThe WalletXChange Team`
    );

    res.send({
      success: true,
      message: "Withdrawal successful",
      transactionId: newTransaction._id,
      payoutId: payoutBatchId,
    });
  } catch (error) {
    res.send({
      message: "Error processing withdrawal",
      data: purify.sanitize(error.message),
      success: false,
    });
  }
});

module.exports = router;
