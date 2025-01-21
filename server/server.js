require('dotenv').config();

const helmet = require('helmet');
const express = require("express");
const cors = require('cors');
const ddosProtection = require("./middlewares/ddosRateLimiter");

const app = express();
const cookieParser = require('cookie-parser');

// Allow requests from localhost:3000
app.use(cors({
  origin: ['http://localhost:3000', process.env.cors_url],
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true
}));

// Use Helmet with custom settings
app.use(helmet({
  // Content Security Policy (CSP)
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"], // Only allow resources from the same origin (self)
      scriptSrc: ["'self'"], // Only allow scripts from the same origin (self)
      objectSrc: ["'none'"], // Prevent all plugins (e.g., Flash, Java applets)
    },
  },
  // Referrer-Policy Header: Controls the amount of information sent with HTTP requests
  referrerPolicy: { policy: "no-referrer" }, 
  // "no-referrer" means no referrer information will be sent with requests

  // Strict-Transport-Security (HSTS)
  strictTransportSecurity: {
    maxAge: 31536000, // 1 year in seconds (duration to enforce HTTPS)
    includeSubDomains: true, // Apply this policy to all subdomains
  },
}));

app.use(express.json());
app.use(cookieParser());

const dbConfig = require('./config/dbConfig');
const userRoute = require('./routes/usersRoute');
const transactionsRoute = require("./routes/transactionsRoute");
const requestsRoute = require("./routes/requestsRoute");
const ddosRoute = require("./routes/ddosRoute");

const PORT = process.env.PORT || 5000;

app.use("/api", ddosRoute);
app.use("/api/", ddosProtection);
app.use('/api/users', userRoute);
app.use("/api/transactions", transactionsRoute);
app.use("/api/requests", requestsRoute);

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});