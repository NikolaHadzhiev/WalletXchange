# Load Testing with K6 and Test User Management

The WalletXchange system includes comprehensive performance and load testing using [k6](https://k6.io/) to ensure the application can handle expected loads. The testing setup includes automatic management of test users.

## Prerequisites

- [k6](https://k6.io/docs/getting-started/installation/) installed on your system
- MongoDB database connection configured in `.env.development` file

## Available Scripts

The following npm scripts are available for load testing:

### Setup Test Users

```bash
npm run setup-test-users
```

Creates the necessary test users in the database that will be used for load testing.

### Run Load Test

```bash
npm run load-test
```

Runs the load test scenario defined in `api-load.test.k6.js` with predefined test users.

### Clean Up Test Users

```bash
npm run cleanup-test-users
```

Cleans up all test users and their related data from the database after testing.

### Full Load Test Cycle

```bash
npm run load-test:full
```

Performs the complete load test cycle:
1. Sets up test users
2. Runs the load test
3. Cleans up test users and related data

### Load Test with Cleanup

```bash
npm run load-test:clean
```

Runs the load test and cleans up afterward (assumes test users are already set up).

## Test Users

The load testing uses dedicated test user accounts to prevent interference with real user data. These accounts have fixed IDs:

- User 1: `walletxchangeloadtestus1@gmail.com` (ID: `680cd20f631e084fcb6c683d`)
- User 2: `walletxchangeloadtestus2@gmail.com` (ID: `680cd31b631e084fcb6c842`)

Additionally, any user with "loadtest" in their email will be automatically cleaned up by the cleanup scripts.

## Customizing Load Tests

To customize the load test scenarios:

1. Modify `api-load.test.k6.js` in the `tests/performance/` directory
2. Adjust the stages, durations, and virtual user counts as needed
3. Modify the endpoints being tested or the test user credentials

Remember to run the cleanup script after any load test to ensure test data doesn't persist in the production database.

## Environmental Configuration

Load tests use the `NODE_ENV=test` environment variable to:
1. Disable email sending functionality
2. Bypass certain rate limits and security measures designed for testing

This ensures load tests don't trigger real emails and don't affect external services while still providing accurate performance metrics.

## Troubleshooting

- If you encounter authentication failures, ensure test users are properly set up using `npm run setup-test-users`
- If tests don't clean up properly, run `npm run cleanup-test-users` manually
- Check MongoDB connection strings in environment variables if database operations fail
