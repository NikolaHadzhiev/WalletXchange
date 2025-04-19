const mongoose = require("mongoose");
const router = require("express").Router();
const Transaction = require("../models/transactionModel");
const { authenticationMiddleware } = require("../middlewares/authMiddleware");
const User = require("../models/userModel");
const DeletedUser = require("../models/deletedUserModel");
const DepositCode = require("../models/depositCodeModel");

const stripe = require("stripe")(process.env.stripe_key);
const DOMPurify = require("dompurify"); // Import DOMPurify for sanitization
const { JSDOM } = require("jsdom");
const nodemailer = require("nodemailer"); // For sending emails

const window = new JSDOM("").window;
const purify = DOMPurify(window);

// Create reusable email transporter object
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

// Helper function to send transaction notification emails
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

// Transfer money from one account to another
router.post("/transfer-money", authenticationMiddleware, async (req, res) => {
  try {
    // Validate and sanitize sender ID
    const senderId = new mongoose.Types.ObjectId(req.body.sender); // Use 'new' to instantiate ObjectId
    if (!mongoose.isValidObjectId(senderId)) {
      return res.send({
        message: "Invalid sender ID",
        data: null,
        success: false,
      });
    }

    // Validate and sanitize receiver ID
    const receiverId = new mongoose.Types.ObjectId(req.body.receiver); // Use 'new' to instantiate ObjectId
    if (!mongoose.isValidObjectId(receiverId)) {
      return res.send({
        message: "Invalid receiver ID",
        data: null,
        success: false,
      });
    }

    // Sanitize and validate the amount (ensure it's a positive number)
    const amount = parseFloat(req.body.amount);
    if (isNaN(amount) || amount <= 0) {
      return res.send({
        message: "Invalid amount. Please provide a positive number.",
        data: null,
        success: false,
      });
    }

    // Retrieve sender from the database
    const sender = await User.findById(senderId);
    if (!sender) {
      return res.send({
        message: "Sender not found",
        data: null,
        success: false,
      });
    }

    // Check if sender has enough balance
    if (sender.balance < amount) {
      return res.send({
        message: "Transaction failed. Insufficient amount",
        data: null,
        success: false,
      });
    }

    // Create the transaction object and sanitize description if provided
    const transaction = {
      sender: senderId,
      receiver: receiverId,
      amount,
      reference: purify.sanitize(req.body.reference || "No description"), // Sanitize reference field
      status: "success",
    };

    // Save the transaction
    const newTransaction = new Transaction(transaction);
    await newTransaction.save();

    // Decrease the sender's balance
    await User.findByIdAndUpdate(senderId, {
      $inc: { balance: -amount },
    });

    // Increase the receiver's balance
    await User.findByIdAndUpdate(receiverId, {
      $inc: { balance: amount },
    });

    // Get sender and receiver details for email notifications
    const senderUser = await User.findById(senderId);
    const receiverUser = await User.findById(receiverId);

    // Send email notifications
    if (senderUser && senderUser.email) {
      await sendTransactionEmail(
        senderUser.email,
        "Money Transfer Confirmation - WalletXChange",
        `Dear ${senderUser.firstName},

          We're writing to confirm that your transaction has been processed successfully.

          Transaction details:
          - Recipient: ${receiverUser ? `${receiverUser.firstName} ${receiverUser.lastName}` : 'User'}
          - Reference: ${transaction.reference}
          - Date: ${new Date().toLocaleString()}

          Thank you for using WalletXChange!

          Best regards,
          The WalletXChange Team`
      );
    }

    if (receiverUser && receiverUser.email) {
      await sendTransactionEmail(
        receiverUser.email,
        "Money Received - WalletXChange",
        `Dear ${receiverUser.firstName},

          Good news! You've received a new payment.

          Transaction details:
          - Sender: ${senderUser ? `${senderUser.firstName} ${senderUser.lastName}` : 'User'}
          - Reference: ${transaction.reference}
          - Date: ${new Date().toLocaleString()}

          Thank you for using WalletXChange!

          Best regards,
          The WalletXChange Team`
      );
    }

    res.send({
      message: "Transaction successful",
      data: newTransaction,
      success: true,
    });
  } catch (error) {
    res.send({
      message: "Transaction failed",
      data: error.message,
      success: false,
    });
  }
});

// verify receiver's account number
router.post("/verify-account", authenticationMiddleware, async (req, res) => {
  try {
    // Sanitize and normalize the userId and receiver values
    const senderId = purify.sanitize(req.body.userId?.toLowerCase()?.trim());
    const receiverId = purify.sanitize(req.body.receiver?.toLowerCase()?.trim());

    if (!senderId || !receiverId) {
      return res.send({
        message: "Sender or receiver account number is missing",
        data: null,
        success: false,
      });
    }

    // Check if sender and receiver account numbers are the same
    if (senderId === receiverId) {
      return res.send({
        message: "Receiver account number can't be the same as sender account number",
        data: null,
        success: false,
      });
    }

    // Ensure the receiver is a valid MongoDB ObjectId
    if (!mongoose.isValidObjectId(receiverId)) {
      return res.send({
        message: "Invalid receiver account number",
        data: null,
        success: false,
      });
    }

    // Search for the receiver's account in the database
    const user = await User.findOne({ _id: receiverId });

    if (user) {
      res.send({
        message: "Account verified",
        data: purify.sanitize(user),  // Sanitize user data before returning
        success: true,
      });
    } else {
      res.send({
        message: "Account not found",
        data: null,
        success: false,
      });
    }
  } catch (error) {
    res.send({
      message: "Account not found",
      data: purify.sanitize(error.message),  // Sanitize error message to prevent XSS
      success: false,
    });
  }
});

// get all transactions for a user
router.post(
  "/get-all-transactions-by-user",
  authenticationMiddleware,

  async (req, res) => {
    try {
      const transactions = await Transaction.find({
        $or: [{ sender: req.body.userId }, { receiver: req.body.userId }],
      })
        .sort({ createdAt: -1 })
        .populate("sender", "-password")
        .populate("receiver", "-password");

      const transactionIds = transactions.map(t => t._id);

      const deletedUser = await DeletedUser.findOne({"transactions._id": {$in: transactionIds}});

      // Check and modify transactions if receiver is null
      const modifiedTransactions = transactions.map((transaction) => {
        if (!transaction.receiver && deletedUser?.transactions?.some(t => t._id.toString() === transaction.id)) {
          transaction.receiver = { _id: deletedUser.deleteId, firstName: deletedUser.firstName, lastName: deletedUser.lastName };
        }

        if(!transaction.sender && deletedUser?.transactions?.some(t => t._id.toString() === transaction.id)) {
          transaction.sender = { _id: deletedUser.deleteId, firstName: deletedUser.firstName, lastName: deletedUser.lastName };
        }

        return transaction;
      });

      res.send({
        message: "Transactions fetched",
        data: modifiedTransactions,
        success: true,
      });
    } catch (error) {
      res.send({
        message: "Transactions not fetched",
        data: error.message,
        success: false,
      });
    }
  }
);

//deposit money using stripe
router.post("/deposit-money", authenticationMiddleware, async (req, res) => {
  try {
    const { token, amount, userId } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.send({ message: "Invalid amount", data: null, success: false });
    }

    if (!token || !token.email || !token.id) {
      return res.send({ message: "Invalid token data", data: null, success: false });
    }

    const sanitizedEmail = purify.sanitize(token.email.trim().toLowerCase());
    const sanitizedTokenId = purify.sanitize(token.id.trim());

    if (!mongoose.isValidObjectId(userId)) {
      return res.send({ message: "Invalid user ID", data: null, success: false });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000); // 6-digit code

    // Save the verification code to MongoDB
    const expirationTime = new Date(Date.now() + 10 * 60 * 1000); // Code valid for 10 minutes
    await DepositCode.create({
      userId,
      email: sanitizedEmail,
      stripeId: sanitizedTokenId,
      veritificationCode: verificationCode.toString(),
      expiresAt: expirationTime,
    });

    const transporter = nodemailer.createTransport({
      host: process.env.email_host,
      port: process.env.email_port,
      secure: true,
      auth: {
        user: process.env.email_username,
        pass: process.env.email_password,
      },
    });

    const mailOptions = {
      from: process.env.email_username,
      to: sanitizedEmail,
      subject: "Deposit Verification Code for WalletXChange",
      text: `Dear user,

      Your verification code for confirming your deposit is: ${verificationCode}.

      Please enter this code within 10 minutes to complete your deposit. If you did not request this deposit, please disregard this message.

      Thank you for using our service!`,
    };

    await transporter.sendMail(mailOptions);

    res.send({
      message: "A verification code has been sent to your email. Please enter the code to proceed with the deposit.",
      success: true,
    });
  } catch (error) {
    res.send({
      message: "Error initiating deposit",
      data: purify.sanitize(error.message),
      success: false,
    });
  }
});

// verify deposit code
router.post("/verify-deposit", authenticationMiddleware, async (req, res) => {
  try {
    const { userId, verificationCode, amount } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.send({ message: "Invalid amount", data: null, success: false });
    }

    if (!mongoose.isValidObjectId(userId)) {
      return res.send({ message: "Invalid user ID", data: null, success: false });
    }

    // Find the code in the database
    const codeRecord = await DepositCode.findOne({ userId, veritificationCode: verificationCode });

    if (!codeRecord) {
      return res.send({
        success: false,
        message: "Invalid or expired verification code",
      });
    }

    // Create a customer on Stripe
    const customer = await stripe.customers.create({
      email: codeRecord.email,
      source: codeRecord.stripeId,
    });

    // Proceed with Stripe deposit
    const charge = await stripe.charges.create({
      amount: amount * 100,
      currency: "usd",
      customer: customer.id,
      receipt_email: customer.email,
      description: "Deposited to WALLETXCHANGE",
    });

    if (charge.status === "succeeded") {
      const newTransaction = new Transaction({
        sender: userId,
        receiver: userId,
        amount,
        type: "Deposit",
        reference: "Stripe deposit",
        status: "success",
      });

      await newTransaction.save();
      await User.findByIdAndUpdate(userId, {
        $inc: { balance: amount },
      });

      // Delete the verification code after successful deposit
      await DepositCode.deleteOne({ _id: codeRecord._id });

      // Send confirmation email for successful deposit
      const user = await User.findById(userId);
      if (user && user.email) {
        await sendTransactionEmail(
          user.email,
          "Deposit Successful - WalletXChange",
          `Dear ${user.firstName},

            We're pleased to confirm that your deposit has been completed successfully.

            Deposit details:
            - Transaction ID: ${newTransaction._id}
            - Date: ${new Date().toLocaleString()}

            Thank you for using WalletXChange!

            Best regards,
            The WalletXChange Team`
        );
      }

      res.send({
        success: true,
        message: "Deposit successful",
      });
    } else {
      res.send({
        success: false,
        message: "Transaction failed",
      });
    }
  } catch (error) {
    res.send({
      message: "Error verifying deposit",
      data: purify.sanitize(error.message),
      success: false,
    });
  }
});

module.exports = router;
