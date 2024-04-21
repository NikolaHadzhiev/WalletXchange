require('dotenv').config();

const express = require("express");
const cors = require('cors');

const app = express();

// Allow requests from localhost:3000
app.use(cors({
  origin: 'http://localhost:3000'
}));

app.use(express.json());

const dbConfig = require('./config/dbConfig');
const userRoute = require('./routes/usersRoute');

const PORT = process.env.PORT || 5000;

app.use('/api/users', userRoute);

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });