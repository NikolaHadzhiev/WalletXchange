require('dotenv').config();

const express = require("express");
const app = express();

const dbConfig = require('./config/dbConfig');
const userRoute = requite('./routes/userRoute');

const PORT = process.env.PORT || 5000;

app.use('/api/users', userRoute);

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });