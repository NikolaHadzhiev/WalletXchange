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

    // Calculate totals
    const totalIncome = receivedTransactions.reduce(
      (total, transaction) => total + transaction.amount,
      0
    );
    
    const totalExpenses = sentTransactions.reduce(
      (total, transaction) => total + transaction.amount,
      0
    );

    const netFlow = totalIncome - totalExpenses;

    res.send({
      message: "Transaction summary fetched",
      data: {
        totalIncome,
        totalExpenses,
        netFlow,
        incomingTransactionCount: receivedTransactions.length,
        outgoingTransactionCount: sentTransactions.length,
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
    const { userId, year } = req.body;
    
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
    
    // Start and end dates for the target year
    const startDate = new Date(targetYear, 0, 1); // January 1
    const endDate = new Date(targetYear, 11, 31); // December 31    
    
    // Aggregate income by month
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
      const expenseEntry = monthlyExpenses.find(item => item._id === month);
      
      return {
        month,
        income: incomeEntry ? incomeEntry.total : 0,
        expenses: expenseEntry ? expenseEntry.total : 0
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
    const incomeCategories = {};

    // Process sent transactions (expenses)
    sentTransactions.forEach(transaction => {
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

    // Process received transactions (income)
    receivedTransactions.forEach(transaction => {
      const reference = transaction.reference.toLowerCase();
      let category = "Other";
      
      // Simple categorization based on keywords
      if (reference.includes("salary") || reference.includes("wage")) {
        category = "Salary";
      } else if (reference.includes("gift")) {
        category = "Gifts";
      } else if (reference.includes("refund") || reference.includes("return")) {
        category = "Refunds";
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
