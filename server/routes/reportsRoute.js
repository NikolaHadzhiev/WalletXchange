const router = require("express").Router();
const Transaction = require("../models/transactionModel");
const { authenticationMiddleware } = require("../middlewares/authMiddleware");
const mongoose = require("mongoose");

// Get transaction summary (income, expenses, net flow) for a user
router.post("/get-transaction-summary", authenticationMiddleware, async (req, res) => {
  try {
    const { userId, fromDate, toDate } = req.body;
    
    // Validate userId
    if (!mongoose.isValidObjectId(userId)) {
      return res.send({
        message: "Invalid user ID",
        data: null,
        success: false,
      });
    }

    // Build date filter if provided
    const dateFilter = {};
    if (fromDate && toDate) {
      dateFilter.createdAt = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate),
      };
    } else if (fromDate) {
      dateFilter.createdAt = { $gte: new Date(fromDate) };
    } else if (toDate) {
      dateFilter.createdAt = { $lte: new Date(toDate) };
    }    
    
    // Query for received money (income)
    const receivedTransactions = await Transaction.find({
      receiver: userId,
      sender: { $ne: userId }, // Exclude self-transfers
      ...dateFilter
    });
    
    // Query for sent money (expenses)
    const sentTransactions = await Transaction.find({
      sender: userId,
      receiver: { $ne: userId }, // Exclude self-transfers
      ...dateFilter
    });
    
    // Query for deposit transactions (sender and receiver are the same)
    const depositTransactions = await Transaction.find({
      sender: userId,
      receiver: userId,
      ...dateFilter
    });    
      // Identify withdrawals (self-transactions that have 'withdrawal' in the reference)
    const withdrawalTransactions = depositTransactions.filter(
      transaction => transaction.reference && transaction.reference.toLowerCase().includes('withdrawal')
    );
    
    // Identify true deposits (self-transactions that don't have 'withdrawal' in the reference)
    const trueDepositTransactions = depositTransactions.filter(
      transaction => !transaction.reference || !transaction.reference.toLowerCase().includes('withdrawal')
    );
    
    // Calculate totals
    const totalIncome = receivedTransactions.reduce(
      (total, transaction) => total + transaction.amount,
      0
    ) + trueDepositTransactions.reduce(
      (total, transaction) => total + transaction.amount,
      0
    );
    
    const totalExpenses = sentTransactions.reduce(
      (total, transaction) => total + transaction.amount,
      0
    ) + withdrawalTransactions.reduce(
      (total, transaction) => total + transaction.amount,
      0
    );
    
    const netFlow = totalIncome - totalExpenses;    // Process transaction counts properly
    const regularIncomingCount = receivedTransactions.length;  // Regular transfers received
    const depositCount = trueDepositTransactions.length;  // Self-deposits (excluding withdrawals)
    const withdrawalCount = withdrawalTransactions.length;  // Withdrawals
    const outgoingCount = sentTransactions.length + withdrawalCount;  // Money sent to others + withdrawals

    // Calculate total incoming count by combining regular incoming transfers and deposits
    const totalIncomingCount = regularIncomingCount + depositCount;

    res.send({
      message: "Transaction summary fetched",
      data: {
        totalIncome,
        totalExpenses,
        netFlow,
        incomingTransactionCount: totalIncomingCount,
        outgoingTransactionCount: outgoingCount
      },
      success: true,
    });
  } catch (error) {
    res.send({
      message: "Failed to fetch transaction summary",
      data: error.message,
      success: false,
    });
  }
});

// Get monthly transaction data for charts
router.post("/get-monthly-data", authenticationMiddleware, async (req, res) => {
  try {
    const { userId, year, fromDate, toDate } = req.body;
    
    // Validate userId
    if (!mongoose.isValidObjectId(userId)) {
      return res.send({
        message: "Invalid user ID",
        data: null,
        success: false,
      });
    }

    // Default to current year if not specified
    const targetYear = year || new Date().getFullYear();
    
    // Start and end dates - use provided date range if available
    let startDate, endDate;
    
    if (fromDate && toDate) {
      startDate = new Date(fromDate);
      endDate = new Date(toDate);
    } else {
      startDate = new Date(targetYear, 0, 1); // January 1
      endDate = new Date(targetYear, 11, 31); // December 31
    }
      // Aggregate income by month (excluding deposits)
    const monthlyIncome = await Transaction.aggregate([
      {
        $match: {
          receiver: new mongoose.Types.ObjectId(userId),
          sender: { $ne: new mongoose.Types.ObjectId(userId) }, // Exclude self-transfers
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          total: { $sum: "$amount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);
      // Aggregate actual deposits by month (self-transfers that don't include "withdrawal" in reference)
    const monthlyDeposits = await Transaction.aggregate([
      {
        $match: {
          receiver: new mongoose.Types.ObjectId(userId),
          sender: new mongoose.Types.ObjectId(userId), // Only include self-transfers
          reference: { $not: /withdrawal/i }, // Exclude withdrawals
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          total: { $sum: "$amount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Aggregate withdrawals by month (self-transfers that include "withdrawal" in reference)
    const monthlyWithdrawals = await Transaction.aggregate([
      {
        $match: {
          receiver: new mongoose.Types.ObjectId(userId),
          sender: new mongoose.Types.ObjectId(userId),
          reference: { $regex: /withdrawal/i }, // Only include withdrawals
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          total: { $sum: "$amount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Aggregate expenses by month
    const monthlyExpenses = await Transaction.aggregate([
      {
        $match: {
          sender: new mongoose.Types.ObjectId(userId),
          receiver: { $ne: new mongoose.Types.ObjectId(userId) }, // Exclude self-transfers
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          total: { $sum: "$amount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);    
      // Format the data for all 12 months
    const formattedData = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const incomeEntry = monthlyIncome.find(item => item._id === month);
      const depositEntry = monthlyDeposits.find(item => item._id === month);
      const withdrawalEntry = monthlyWithdrawals.find(item => item._id === month);
      const expenseEntry = monthlyExpenses.find(item => item._id === month);
      
      // Calculate total income by adding regular income and deposits
      const regularIncome = incomeEntry ? incomeEntry.total : 0;
      const depositIncome = depositEntry ? depositEntry.total : 0;
      const totalIncome = regularIncome + depositIncome;
      
      // Calculate total expenses by adding regular expenses and withdrawals
      const regularExpenses = expenseEntry ? expenseEntry.total : 0;
      const withdrawalExpenses = withdrawalEntry ? withdrawalEntry.total : 0;
      const totalExpenses = regularExpenses + withdrawalExpenses;
      
      return {
        month,
        income: totalIncome,
        expenses: totalExpenses
      };
    });

    res.send({
      message: "Monthly transaction data fetched",
      data: formattedData,
      success: true,
    });
  } catch (error) {
    res.send({
      message: "Failed to fetch monthly transaction data",
      data: error.message,
      success: false,
    });
  }
});

// Get transaction category summary
router.post("/get-category-summary", authenticationMiddleware, async (req, res) => {
  try {
    const { userId, fromDate, toDate } = req.body;
    
    // Validate userId
    if (!mongoose.isValidObjectId(userId)) {
      return res.send({
        message: "Invalid user ID",
        data: null,
        success: false,
      });
    }

    // Build date filter if provided
    const dateFilter = {};
    if (fromDate && toDate) {
      dateFilter.createdAt = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate),
      };
    } else if (fromDate) {
      dateFilter.createdAt = { $gte: new Date(fromDate) };
    } else if (toDate) {
      dateFilter.createdAt = { $lte: new Date(toDate) };
    }

    // Get all transactions for the user (both sent and received)
    const sentTransactions = await Transaction.find({
      sender: userId,
      ...dateFilter
    }).populate("receiver", "firstName lastName");

    const receivedTransactions = await Transaction.find({
      receiver: userId,
      ...dateFilter
    }).populate("sender", "firstName lastName");

    // Analyze references for categorization (simple version)
    const expenseCategories = {};
    const incomeCategories = {};    // Process sent transactions (expenses)
    sentTransactions.forEach(transaction => {
      // Skip self-transactions for withdrawal (these are handled separately)
      if (transaction.sender.toString() === transaction.receiver.toString() && 
          transaction.reference && 
          transaction.reference.toLowerCase().includes("withdrawal")) {
        return;
      }

      const reference = transaction.reference.toLowerCase();
      let category = "Other";
      
      // Simple categorization based on keywords
      if (reference.includes("food") || reference.includes("grocery") || reference.includes("restaurant")) {
        category = "Food";
      } else if (reference.includes("bill") || reference.includes("utility")) {
        category = "Utilities";
      } else if (reference.includes("rent") || reference.includes("housing")) {
        category = "Housing";
      } else if (reference.includes("transport") || reference.includes("gas") || reference.includes("fuel")) {
        category = "Transportation";
      }
      
      expenseCategories[category] = (expenseCategories[category] || 0) + transaction.amount;
    });

    // Add withdrawal transactions to expense categories
    // These have the same sender and receiver and contain "withdrawal" in the reference
    sentTransactions.forEach(transaction => {
      if (transaction.sender.toString() === transaction.receiver.toString() && 
          transaction.reference && 
          transaction.reference.toLowerCase().includes("withdrawal")) {
        const category = "Withdrawal";
        expenseCategories[category] = (expenseCategories[category] || 0) + transaction.amount;
      }
    });

    // Process received transactions (income)
    receivedTransactions.forEach(transaction => {
      // Skip self-transactions for withdrawal (these are handled as expenses)
      if (transaction.sender.toString() === transaction.receiver.toString() && 
          transaction.reference && 
          transaction.reference.toLowerCase().includes("withdrawal")) {
        return;
      }

      const reference = transaction.reference.toLowerCase();
      let category = "Other";
      
      // Simple categorization based on keywords
      if (reference.includes("salary") || reference.includes("wage")) {
        category = "Salary";
      } else if (reference.includes("gift")) {
        category = "Gifts";
      } else if (reference.includes("refund") || reference.includes("return")) {
        category = "Refunds";
      } else if (reference.includes("deposit")) {
        category = "Deposit";
      }
      
      incomeCategories[category] = (incomeCategories[category] || 0) + transaction.amount;
    });

    res.send({
      message: "Category summary fetched",
      data: {
        expenseCategories,
        incomeCategories
      },
      success: true,
    });
  } catch (error) {
    res.send({
      message: "Failed to fetch category summary",
      data: error.message,
      success: false,
    });
  }
});

module.exports = router;
