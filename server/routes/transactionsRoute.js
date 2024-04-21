const router = require("express").Router();
const Transaction = require("../models/transactionModel");
const authMiddleware = require("../middlewares/authMiddleware");
const User = require("../models/userModel");

// transer money from one account to another
router.post("/transfer-money", authMiddleware, async (req, res) => {
  try {
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
router.post("/verify-account", authMiddleware, async (req, res) => {
  try {

    if(req.body.sender === req.body.receiver) {
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
  } 
  catch (error) {
    res.send({
      message: "Account not found",
      data: error.message,
      success: false,
    });
  }
});

module.exports = router;
