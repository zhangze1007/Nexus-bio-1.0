/**
 * Jest setup file — configures test environment before tests run.
 *
 * Sets a unique database path per test run to prevent test isolation issues.
 * Each Jest invocation gets its own SQLite file in /tmp.
 */

import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';

// Generate a unique database path for this test run
const testId = randomUUID().slice(0, 8);
const testDbDir = path.join(process.cwd(), '.nexus', 'test-runs');
const testDbPath = path.join(testDbDir, `test-${testId}.db`);

// Ensure the test directory exists
fs.mkdirSync(testDbDir, { recursive: true });

// Set the database path for all tests in this run
process.env.NEXUS_DB_PATH = testDbPath;

// Clean up the test database on exit
process.on('exit', () => {
  try {
    fs.unlinkSync(testDbPath);
    fs.unlinkSync(testDbPath + '-shm');
    fs.unlinkSync(testDbPath + '-wal');
  } catch {
    // Ignore cleanup errors
  }
});
