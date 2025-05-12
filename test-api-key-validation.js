#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

// Create a clean test environment
async function setupTestEnvironment() {
  // Create a temporary .env.test file that won't be tracked by Git
  try {
    await fs.writeFile('./.env.test', '# Test environment file for bouncer.js\n');
  } catch (error) {
    console.error('Error creating test environment file:', error);
    process.exit(1);
  }
}

// Test cases for API key validation
const TEST_CASES = [
  {
    name: 'Missing API key',
    env: { GEMINI_API_KEY: undefined },
    expectedErrorPattern: /Missing Gemini API key/i
  },
  {
    name: 'Empty API key',
    env: { GEMINI_API_KEY: '' },
    // Node.js treats empty strings in process.env as undefined, so we expect the "Missing" error
    expectedErrorPattern: /Missing Gemini API key/i
  },
  {
    name: 'Short/invalid API key',
    env: { GEMINI_API_KEY: 'short-key' },
    expectedErrorPattern: /Gemini API key appears to be invalid \(too short\)/i
  }
];

// Function to run bouncer.js with a specific environment variable
async function runWithEnvironment(envVars) {
  return new Promise((resolve) => {
    // Create environment with current process env plus test-specific vars
    const env = { ...process.env, ...envVars };

    // Always use our test env file
    env.NODE_ENV = 'test';

    // Run bouncer.js with the test environment
    const child = spawn('node', ['./bouncer.js', '--env-file', './.env.test'], {
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        code,
        stdout,
        stderr
      });
    });
  });
}

// Function to verify log file contains the expected error entry
async function verifyLogEntry(testCase) {
  try {
    const logContent = await fs.readFile('./.bouncer.log.jsonl', 'utf8');
    const logLines = logContent.trim().split('\n');
    const lastEntry = JSON.parse(logLines[logLines.length - 1]);

    // For API key errors, we expect an ERROR verdict
    if (lastEntry.verdict !== 'ERROR') {
      return {
        success: false,
        message: `Expected ERROR verdict but got ${lastEntry.verdict}`
      };
    }

    // Check if the reason contains API Key Error
    if (!lastEntry.reason.includes('API Key Error')) {
      return {
        success: false,
        message: `Expected API Key Error but got: ${lastEntry.reason}`
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: `Error checking log file: ${error.message}`
    };
  }
}

// Run all tests
async function runTests() {
  console.log('🧪 Running API key validation tests...\n');

  // Setup test environment
  await setupTestEnvironment();
  console.log('Test environment created\n');

  let allTestsPassed = true;

  for (const testCase of TEST_CASES) {
    process.stdout.write(`Testing: ${testCase.name}... `);

    const result = await runWithEnvironment(testCase.env);

    // Check if the expected error pattern is in stderr
    const errorMatched = testCase.expectedErrorPattern.test(result.stderr);

    // For exit code, we expect 1 (error)
    const exitCodeCorrect = result.code === 1;

    if (errorMatched && exitCodeCorrect) {
      console.log('✅ PASSED');
    } else {
      allTestsPassed = false;
      console.log('❌ FAILED');

      if (!errorMatched) {
        console.log(`  Expected error pattern: ${testCase.expectedErrorPattern}`);
        console.log('  Error pattern did not match in stderr output:');
        console.log(`  ${result.stderr.trim()}`);
      }

      if (!exitCodeCorrect) {
        console.log(`  Expected exit code 1 but got ${result.code}`);
      }
    }
  }

  console.log('\n🏁 Test summary:');
  if (allTestsPassed) {
    console.log('All API key validation tests passed! ✨');
    return 0;
  } else {
    console.log('Some tests failed. Please review the errors above.');
    return 1;
  }
}

// Run the tests
runTests()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });