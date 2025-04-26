// A simple shell script that runs the load test cleanup
const { execSync } = require('child_process');
const path = require('path');

console.log('Running load test user cleanup...');

try {
  execSync('node tests/performance/cleanup-load-test-users.js', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '../..')
  });
  console.log('Load test cleanup completed successfully');
} catch (error) {
  console.error('Load test cleanup failed:', error);
  process.exit(1);
}
