const router = require("express").Router();
const Request = require("../models/requestsModel");
const {authenticationMiddleware } = require("../middlewares/authMiddleware");
const User = require("../models/userModel");
const DeletedUser = require("../models/deletedUserModel");
const Transaction = require("../models/transactionModel");


// get all requests for a user
router.post("/get-all-requests-by-user", authenticationMiddleware, async (req, res) => {
  try {

    const requests = await Request.find({
      $or: [{ sender: req.body.userId }, { receiver: req.body.userId }],
    })
      .populate("sender")
      .populate("receiver")
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
router.post("/send-request", authenticationMiddleware, async (req, res) => {
  try {

    const { receiver, amount, reference } = req.body;

    const request = new Request({
      sender: req.body.userId,
      receiver,
      amount,
      description: reference,
    });

    await request.save();

    const receiverUser = await User.findById(receiver);

    if (receiverUser.balance < amount) {

      await Request.findByIdAndUpdate(request._id, {
        status: "rejected"
      });

      res.send({
        data: request,
        message: "Reciever of the request does not have enough money",
        success: false,
      });

      return;
    }

    res.send({
      data: request,
      message: "Request sent successfully",
      success: true,
    });

  } 
  catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// update a request status
router.post("/update-request-status", authenticationMiddleware, async (req, res) => {
  try {

    if (req.body.status === "accepted") {
      // create a transaction
      const transaction = new Transaction({
        sender: req.body.receiver._id,
        receiver: req.body.sender._id,
        amount: req.body.amount,
        reference: req.body.description,
        status: "success",
      });

      await transaction.save();

      // add the amount to the receiver
      await User.findByIdAndUpdate(req.body.sender._id, {
        $inc: { balance: req.body.amount },
      });

      // deduct the amount from the sender
      await User.findByIdAndUpdate(req.body.receiver._id, {
        $inc: { balance: -req.body.amount },
      });
    }

    await Request.findByIdAndUpdate(req.body._id, {
      status: req.body.status,
    });

    res.send({
      data: null,
      message: "Request status updated successfully",
      success: true,
    });

  } 
  catch (error) {
    res.send({
      data: error,
      message: error.message,
      success: false,
    });
  }
});

module.exports = router;
