require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development',
});

if (process.env.NODE_ENV === 'production') {
  console.log('Running in production mode');
} else {
  console.log('Running in development mode');
}

const helmet = require('helmet');
const express = require("express");
const cors = require('cors');
const ddosProtection = require("./middlewares/ddosRateLimiter");
const cookieParser = require('cookie-parser');
const path = require("path");

const app = express();

app.use(cors({
  origin: process.env.cors_url,
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  credentials: true,
}));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://checkout.stripe.com"],
      objectSrc: ["'none'"],
    },
  },
  referrerPolicy: { policy: "no-referrer" },
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true,
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

if (process.env.NODE_ENV === 'production') {
  // Serve static files from the React app
  const clientBuildPath = path.join(__dirname, "../client/dist");
  app.use(express.static(clientBuildPath));

  // Serve index.html for any other route not handled by API
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });
}

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
