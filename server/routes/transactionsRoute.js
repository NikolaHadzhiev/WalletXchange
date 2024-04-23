const router = require("express").Router();
const Transaction = require("../models/transactionModel");
const { authenticationMiddleware } = require("../middlewares/authMiddleware");
const User = require("../models/userModel");
const DeletedUser = require("../models/deletedUserModel");

const stripe = require("stripe")(process.env.stripe_key);
const { uuid } = require("uuidv4");

// transer money from one account to another
router.post("/transfer-money", authenticationMiddleware, async (req, res) => {
  try {
    const sender = await User.findById(req.body.sender);

    if (sender.balance < req.body.amount) {
      res.send({
        message: "Transaction failed. Insufficient amount",
        data: null,
        success: false,
      });

      return;
    }

    // save the transaction
    const newTransaction = new Transaction(req.body);
    await newTransaction.save();

    // decrease the sender's balance
    // use of $inc since mongo does not have $dec
    await User.findByIdAndUpdate(req.body.sender, {
      $inc: { balance: -req.body.amount },
    });

    // increase the receiver's balance
    await User.findByIdAndUpdate(req.body.receiver, {
      $inc: { balance: req.body.amount },
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

    if (req.body.userId?.toLowerCase() === req.body.receiver?.toLowerCase()) {

      res.send({
        message: "Reciever account number can't be sender account number",
        data: null,
        success: false,
      });

      return;
    }

    if (req.body.sender?.toLowerCase() === req.body.receiver?.toLowerCase()) {
      res.send({
        message: "Reciever account number can't be sender account number",
        data: null,
        success: false,
      });

      return;
    }

    const user = await User.findOne({ _id: req.body.receiver });

    if (user) {
      res.send({
        message: "Account verified",
        data: user,
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
      data: error.message,
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
        .populate("sender")
        .populate("receiver");

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
    const { token, amount } = req.body;

    // create a customer
    const customer = await stripe.customers.create({
      email: token.email,
      source: token.id,
    });

    // create a charge
    const charge = await stripe.charges.create(
      {
        amount: amount * 100,
        currency: "usd",
        customer: customer.id,
        receipt_email: token.email,
        description: `Deposited to WALLETXCHANGE`,
      },
      {
        idempotencyKey: uuid(),
      }
    );

    // save the transaction
    if (charge.status === "succeeded") {
      const newTransaction = new Transaction({
        sender: req.body.userId,
        receiver: req.body.userId,
        amount: amount,
        type: "Deposit",
        reference: "Stripe deposit",
        status: "success",
      });

      await newTransaction.save();

      // increase the user's balance
      await User.findByIdAndUpdate(req.body.userId, {
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
        data: charge,
        success: false,
      });
    }
  } catch (error) {
    res.send({
      message: "Transaction failed",
      data: error.message,
      success: false,
    });
  }
});

module.exports = router;
