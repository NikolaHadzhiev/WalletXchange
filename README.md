# WalletXchange
WalletXchange is your ultimate destination for seamless digital finance management. In short - a robust virtual wallet platform designed to simplify and enhance sending and receiving money effortlessly, top up your wallet directly from your bank account and make purchases smoothly using funds stored in your wallet. 

## Key Features:

- *Send and Receive Money:* Transfer funds quickly and securely to friends, family, or businesses with ease.

- *Bank Integration:* Link your bank iban to effortlessly charge your wallet balance, ensuring convenient top-ups whenever needed.

- *Secure Transactions:* Rest assured that your transactions are protected with advanced encryption to safeguard your financial data.

- *Convenient Purchases:* Enjoy the flexibility of shopping online or in-store using the funds available in your WalletXchange wallet.

- *User-Friendly Interface:* Navigate our intuitive user interface effortlessly, making financial management a breeze for users of all levels.


## Build Stack:

WalletXchange is built using the MERN stack:

- MongoDB: A NoSQL database for storing wallet data.
- Express.js: A web application framework for building RESTful APIs.
- React.js: A JavaScript library for building user interfaces.
- Node.js: A runtime environment for executing JavaScript code on the server side.

---

## Prerequisites

- [Node.js & npm](https://nodejs.org/) (v18+ recommended)
- [MongoDB](https://www.mongodb.com/try/download/community) (local or cloud instance)
- [k6](https://k6.io/docs/getting-started/installation/) (for performance/load testing)

## Project Structure

```
WalletXchange/
├── client/         # React frontend (Vite)
│   └── src/        # Source code (components, pages, api, state, etc.)
├── server/         # Express backend
│   ├── models/     # Mongoose models
│   ├── routes/     # API routes
│   ├── middlewares/# Express middlewares
│   ├── tests/      # Jest & k6 tests
│   └── ...
├── Dockerfile      # (Optional) Docker support
├── fly.toml        # Fly.io deployment config
└── README.md
```

## Running Locally

### 1. Clone the repository

```powershell
git clone https://github.com/NikolaHadzhiev/WalletXchange.git
cd WalletXchange
```

### 2. Install dependencies

```powershell
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 3. Configure environment variables

- Copy `.env.development` in both `client/` and `server/` and update with your local settings (MongoDB URI, API URLs, etc.)

### 4. Start MongoDB

- Make sure your MongoDB server is running locally or update the connection string for a remote instance.

### 5. Run the backend server

```powershell
cd server
npm start
```

### 6. Run the frontend client

```powershell
cd ../client
npm run dev
```

- The client will typically run on [http://localhost:5173](http://localhost:5173)
- The server will run on [http://localhost:5000](http://localhost:5000) (or as configured)

## Running Tests

### Unit & Integration Tests (Jest)

```powershell
cd server
npm test
```

### Performance/Load Tests (k6)

- Install [k6](https://k6.io/docs/getting-started/installation/) if you haven't already.
- See `server/tests/performance/README.md` for full details.
- Run the server in test mode - cd server / npm run start:loadtest

Common scripts:

```powershell
# Setup test users
npm run setup-test-users

# Run load test
npm run load-test

# Cleanup test users
npm run cleanup-test-users

# Full cycle (setup, test, cleanup)
npm run load-test:full
```

## Integrated Workflows

- **Client/Server Communication:** The React client communicates with the Express API server via RESTful endpoints (see `client/src/api/` and `server/routes/`).
- **Authentication:** JWT-based authentication with optional 2FA (see `server/middlewares/authMiddleware.js`).
- **Payments:** Integration with Stripe and PayPal for deposits/withdrawals.
- **Security:** Includes rate limiting, DDOS protection, and input validation.
- **Testing:** Jest for backend logic, k6 for performance/load testing.

## Get Started:

Join the WalletXchange community today and revolutionize the way you manage your digital finances. Whether you're splitting bills with friends, topping up your wallet on-the-go, or making purchases online, WalletXchange is your go-to platform for seamless transactions.
