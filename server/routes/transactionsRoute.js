const mongoose = require("mongoose");
const router = require("express").Router();
const Transaction = require("../models/transactionModel");
const { authenticationMiddleware } = require("../middlewares/authMiddleware");
const User = require("../models/userModel");
const DeletedUser = require("../models/deletedUserModel");

const stripe = require("stripe")(process.env.stripe_key);
const { uuid } = require("uuidv4");
const DOMPurify = require("dompurify"); // Import DOMPurify for sanitization
const { JSDOM } = require("jsdom");

const window = new JSDOM("").window;
const purify = DOMPurify(window);

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

    // Validate and sanitize amount
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.send({
        message: "Invalid amount",
        data: null,
        success: false,
      });
    }

    // Validate and sanitize token data
    if (!token || !token.email || !token.id) {
      return res.send({
        message: "Invalid token data",
        data: null,
        success: false,
      });
    }

    // Sanitize email and token id
    const sanitizedEmail = purify.sanitize(token.email.trim().toLowerCase());
    const sanitizedTokenId = purify.sanitize(token.id.trim());

    // Ensure userId is a valid MongoDB ObjectId
    if (!mongoose.isValidObjectId(userId)) {
      return res.send({
        message: "Invalid user ID",
        data: null,
        success: false,
      });
    }

    // Create a customer on Stripe
    const customer = await stripe.customers.create({
      email: sanitizedEmail,
      source: sanitizedTokenId,
    });

    // Create a charge on Stripe
    const charge = await stripe.charges.create(
      {
        amount: amount * 100, // Stripe requires the amount in cents
        currency: "usd",
        customer: customer.id,
        receipt_email: sanitizedEmail,
        description: "Deposited to WALLETXCHANGE",
      },
      {
        idempotencyKey: uuid(),
      }
    );

    // Save the transaction if the charge is successful
    if (charge.status === "succeeded") {
      const newTransaction = new Transaction({
        sender: userId,
        receiver: userId,
        amount: amount,
        type: "Deposit",
        reference: "Stripe deposit",
        status: "success",
      });

      await newTransaction.save();

      // Increase the user's balance
      await User.findByIdAndUpdate(userId, {
        $inc: { balance: amount },
      });

      res.send({
        message: "Transaction successful",
        data: newTransaction,
        success: true,
      });
    } else {
      res.send({
        message: "Transaction failed",
        data: purify.sanitize(charge), // Sanitize charge data before sending
        success: false,
      });
    }
  } catch (error) {
    res.send({
      message: "Transaction failed",
      data: purify.sanitize(error.message), // Sanitize error message to avoid XSS
      success: false,
    });
  }
});

module.exports = router;
