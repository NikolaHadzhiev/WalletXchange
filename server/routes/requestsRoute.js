const router = require("express").Router();
const Request = require("../models/requestsModel");
const {authenticationMiddleware } = require("../middlewares/authMiddleware");
const User = require("../models/userModel");
const DeletedUser = require("../models/deletedUserModel");
const Transaction = require("../models/transactionModel");
const { body, validationResult } = require("express-validator");
const { JSDOM } = require("jsdom");
const DOMPurify = require("dompurify");
const nodemailer = require("nodemailer");

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

// Helper function to send money request notification emails
const sendRequestEmail = async (email, subject, message) => {
  // Skip email sending if in test environment
  if (process.env.NODE_ENV === "test") {
    console.log("Test environment detected, skipping email:", { to: email, subject });
    return true;
  }
  
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

// get all requests for a user
router.post("/get-all-requests-by-user", authenticationMiddleware, async (req, res) => {
  try {

    const requests = await Request.find({
      $or: [{ sender: req.body.userId }, { receiver: req.body.userId }],
    })
      .populate("sender", "-password")
      .populate("receiver", "-password")
      .sort({ createdAt: -1 });

      const requestIds = requests.map(r => r._id);

      const deletedUser = await DeletedUser.findOne({"requests._id": {$in: requestIds}});

      // Check and modify requests if receiver is null
      const modifiedRequests = requests.map((request) => {
        if (!request.receiver && deletedUser?.requests?.some(r => r._id.toString() === request.id)) {
          request.receiver = { _id: deletedUser.deleteId, firstName: deletedUser.firstName, lastName: deletedUser.lastName };
        }

        if(!request.sender && deletedUser?.requests?.some(r => r._id.toString() === request.id)) {
          request.sender = { _id: deletedUser.deleteId, firstName: deletedUser.firstName, lastName: deletedUser.lastName };
        }

        return request;
      });

    res.send({
      data: modifiedRequests,
      message: "Requests fetched successfully",
      success: true,
    });

  } 
  catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// send a request to another user
router.post(
  "/send-request",
  authenticationMiddleware,
  [
    // Validation middleware for inputs
    body("receiver")
      .trim()
      .isMongoId()
      .withMessage("Invalid receiver ID format"),
    body("amount")
      .isFloat({ min: 0.01 })
      .withMessage("Amount must be a positive number"),
    body("reference").trim().escape(),
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      // Sanitize inputs
      const receiver = purify.sanitize(req.body.receiver);
      const amount = parseFloat(req.body.amount); // Ensure `amount` is a valid number
      const reference = purify.sanitize(req.body.reference);

      // Create the request
      const request = new Request({
        sender: req.body.userId,
        receiver,
        amount,
        description: reference,
      });

      await request.save();

      const receiverUser = await User.findById(receiver);

      // Check receiver's balance
      if (receiverUser.balance < amount) {
        await Request.findByIdAndUpdate(request._id, {
          status: "rejected",
        });

        return res.send({
          data: request,
          message: "Receiver of the request does not have enough money",
          success: false,
        });
      }

      res.send({
        data: request,
        message: "Request sent successfully",
        success: true,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// update a request status
router.post(
  "/update-request-status",
  authenticationMiddleware,
  [
    // Validation middleware for inputs
    body("_id")
      .trim()
      .isMongoId()
      .withMessage("Invalid request ID format"),
    body("status")
      .isIn(["accepted", "rejected", "pending"])
      .withMessage("Invalid status value"),
    body("receiver._id")
      .trim()
      .isMongoId()
      .withMessage("Invalid receiver ID format"),
    body("sender._id")
      .trim()
      .isMongoId()
      .withMessage("Invalid sender ID format"),
    body("amount")
      .isFloat({ min: 0.01 })
      .withMessage("Amount must be a positive number"),
    body("description").trim().escape(),
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      // Sanitize inputs
      const sanitizedRequestId = purify.sanitize(req.body._id);
      const sanitizedStatus = purify.sanitize(req.body.status);
      const sanitizedReceiverId = purify.sanitize(req.body.receiver._id);
      const sanitizedSenderId = purify.sanitize(req.body.sender._id);
      const sanitizedAmount = parseFloat(req.body.amount);
      const sanitizedDescription = purify.sanitize(req.body.description);

      if (sanitizedStatus === "accepted") {
        // Create a transaction
        const transaction = new Transaction({
          sender: sanitizedReceiverId,
          receiver: sanitizedSenderId,
          amount: sanitizedAmount,
          reference: sanitizedDescription,
          status: "success",
        });

        await transaction.save();

        // Add the amount to the receiver
        await User.findByIdAndUpdate(sanitizedSenderId, {
          $inc: { balance: sanitizedAmount },
        });

        // Deduct the amount from the sender
        await User.findByIdAndUpdate(sanitizedReceiverId, {
          $inc: { balance: -sanitizedAmount },
        });
      }

      // Update the request status
      await Request.findByIdAndUpdate(sanitizedRequestId, {
        status: sanitizedStatus,
      });

      // Get sender and receiver details for email notifications
      const senderUser = await User.findById(sanitizedSenderId);
      const receiverUser = await User.findById(sanitizedReceiverId);

      // Send email notifications based on the status
      if (sanitizedStatus === "accepted") {
        // Notify the sender that the request was accepted
        if (senderUser && senderUser.email) {
          await sendRequestEmail(
            senderUser.email,
            "Money Request Accepted - WalletXChange",
            `Dear ${senderUser.firstName},

              Good news! Your money request has been accepted.

              Request details:
              - Requested from: ${receiverUser ? `${receiverUser.firstName} ${receiverUser.lastName}` : 'User'}
              - Reference: ${sanitizedDescription}
              - Date: ${new Date().toLocaleString()}

              The amount has been added to your balance.

              Thank you for using WalletXChange!

              Best regards,
              The WalletXChange Team`
          );
        }

        // Notify the receiver that they accepted the request
        if (receiverUser && receiverUser.email) {
          await sendRequestEmail(
            receiverUser.email,
            "Money Request Payment Confirmation - WalletXChange",
            `Dear ${receiverUser.firstName},

              This is a confirmation that you have accepted a money request.

              Request details:
              - Requested by: ${senderUser ? `${senderUser.firstName} ${senderUser.lastName}` : 'User'}
              - Reference: ${sanitizedDescription}
              - Date: ${new Date().toLocaleString()}

              The amount has been deducted from your balance.

              Thank you for using WalletXChange!

              Best regards,
              The WalletXChange Team`
          );
        }
      } else if (sanitizedStatus === "rejected") {
        // Notify the sender that the request was rejected
        if (senderUser && senderUser.email) {
          await sendRequestEmail(
            senderUser.email,
            "Money Request Rejected - WalletXChange",
            `Dear ${senderUser.firstName},

              We regret to inform you that your money request has been rejected.

              Request details:
              - Requested from: ${receiverUser ? `${receiverUser.firstName} ${receiverUser.lastName}` : 'User'}
              - Reference: ${sanitizedDescription}
              - Date: ${new Date().toLocaleString()}

              If you have any questions, please contact the person you sent the request to.

              Thank you for using WalletXChange!

              Best regards,
              The WalletXChange Team`
          );
        }

        // Notify the receiver that they rejected the request
        if (receiverUser && receiverUser.email) {
          await sendRequestEmail(
            receiverUser.email,
            "Money Request Rejected Confirmation - WalletXChange",
            `Dear ${receiverUser.firstName},

              This is a confirmation that you have rejected a money request.

              Request details:
              - Requested by: ${senderUser ? `${senderUser.firstName} ${senderUser.lastName}` : 'User'}
              - Reference: ${sanitizedDescription}
              - Date: ${new Date().toLocaleString()}

              No money has been transferred from your account.

              Thank you for using WalletXChange!

              Best regards,
              The WalletXChange Team`
          );
        }
      }

      res.send({
        data: null,
        message: "Request status updated successfully",
        success: true,
      });
    } catch (error) {
      res.status(500).send({
        data: null,
        message: error.message,
        success: false,
      });
    }
  }
);

module.exports = router;
