#!/usr/bin/env node
/**
 * Test script for Gemini API error handling in bouncer.js
 * Tests various error scenarios to ensure proper error messages, logging, and exit codes
 */
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";

// Constants
const TEST_DIR = path.resolve('./test-temp');
const TEST_ENV_FILE = path.join(TEST_DIR, '.env.test');
const TEST_RULES_FILE = path.join(TEST_DIR, 'rules.md');

// Create a clean test environment
async function setupTestEnvironment() {
  // Remove existing test directory if it exists
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  
  // Create test directory
  mkdirSync(TEST_DIR, { recursive: true });
  
  // Create a test .env file with API key
  await fs.writeFile(
    TEST_ENV_FILE,
    'GEMINI_API_KEY=test-api-key-for-gemini-api-error-tests\n'
  );
  
  // Create a minimal rules file
  await fs.writeFile(
    TEST_RULES_FILE,
    '# Test Rules\n1. No secrets should be committed\n'
  );
  
  console.log('Test environment created');
}

// Test cases for Gemini API error handling
const TEST_CASES = [
  {
    name: 'Authentication error (401)',
    operation: 'content generation',
    // We'll override the environment variables to simulate response errors
    environmentOverrides: { 
      GEMINI_API_KEY: 'invalid-key-to-trigger-401',
      TEST_SIMULATE_ERROR: 'auth-401' 
    },
    expectedExitCode: 1,
    expectedErrorCheck: (stderr) => stderr.includes('Authentication error'),
    expectedLogCheck: (log) => (
      log.verdict === 'ERROR' && 
      log.reason && 
      log.reason.includes('Gemini API Error') &&
      log.error && 
      log.error.type === 'Authentication'
    )
  },
  {
    name: 'Rate limit error (429)',
    operation: 'content generation',
    environmentOverrides: { 
      TEST_SIMULATE_ERROR: 'rate-limit-429' 
    },
    expectedExitCode: 1,
    expectedErrorCheck: (stderr) => stderr.includes('Rate Limit error'),
    expectedLogCheck: (log) => (
      log.verdict === 'ERROR' && 
      log.reason && 
      log.reason.includes('Gemini API Error') &&
      log.error && 
      log.error.type === 'Rate Limit'
    )
  },
  {
    name: 'Server error (500)',
    operation: 'content generation',
    environmentOverrides: { 
      TEST_SIMULATE_ERROR: 'server-500' 
    },
    expectedExitCode: 1,
    expectedErrorCheck: (stderr) => stderr.includes('Server error'),
    expectedLogCheck: (log) => (
      log.verdict === 'ERROR' && 
      log.reason && 
      log.reason.includes('Gemini API Error') &&
      log.error && 
      log.error.type === 'Server'
    )
  },
  {
    name: 'Network error (ENOTFOUND)',
    operation: 'content generation',
    environmentOverrides: { 
      TEST_SIMULATE_ERROR: 'network-enotfound',
      // Force an invalid API endpoint to actually cause a network error
      GEMINI_API_ENDPOINT: 'https://invalid-domain-that-doesnt-exist.example.com'
    },
    expectedExitCode: 1,
    expectedErrorCheck: (stderr) => stderr.includes('Network error'),
    expectedLogCheck: (log) => (
      log.verdict === 'ERROR' && 
      log.reason && 
      log.reason.includes('Gemini API Error') &&
      log.error && 
      log.error.type === 'Network'
    )
  },
  {
    name: 'Timeout error (ETIMEDOUT)',
    operation: 'content generation',
    environmentOverrides: { 
      TEST_SIMULATE_ERROR: 'timeout-etimedout' 
    },
    expectedExitCode: 1,
    expectedErrorCheck: (stderr) => stderr.includes('Timeout error'),
    expectedLogCheck: (log) => (
      log.verdict === 'ERROR' && 
      log.reason && 
      log.reason.includes('Gemini API Error') &&
      log.error && 
      log.error.type === 'Timeout'
    )
  },
  {
    name: 'Token counting error (recoverable)',
    operation: 'token counting',
    environmentOverrides: { 
      TEST_SIMULATE_ERROR: 'token-counting' 
    },
    // Token counting errors should not cause exit - process should continue with estimation
    expectedExitCode: 0,
    expectedErrorCheck: (stderr) => stderr.includes('Token counting API failed'),
    expectedStdoutCheck: (stdout) => stdout.includes('PASS') || stdout.includes('FAIL'),
    expectedLogCheck: (log) => (
      // The last log entry should be a normal verdict, not an error, 
      // since token counting errors are recovered from
      (log.verdict === 'PASS' || log.verdict === 'FAIL')
    )
  }
];

// Function to run bouncer with test case
async function runBouncerWithTestCase(testCase) {
  return new Promise((resolve) => {
    // Set up environment
    const env = { 
      ...process.env, 
      GEMINI_API_KEY: 'test-api-key-for-gemini-api-error-tests',
      // Add empty diff for testing - we're focusing on API errors, not diff processing
      TEST_EMPTY_DIFF: 'true'
    };
    
    // Add any environment overrides from the test case
    if (testCase.environmentOverrides) {
      Object.assign(env, testCase.environmentOverrides);
    }
    
    // Run bouncer.js
    const child = spawn(
      'node', 
      [
        path.resolve('./bouncer.js'),
        '--env-file', TEST_ENV_FILE,
        '--rules-file', TEST_RULES_FILE,
        '--log-file', path.join(TEST_DIR, '.bouncer.log.jsonl')
      ], 
      { 
        cwd: TEST_DIR,
        env,
        stdio: ['pipe', 'pipe', 'pipe'] 
      }
    );
    
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

// Function to verify log file against test case expectations
async function verifyLogFile(testCase) {
  try {
    const logFilePath = path.join(TEST_DIR, '.bouncer.log.jsonl');
    if (!existsSync(logFilePath)) {
      return {
        success: false,
        message: `Log file not created at ${logFilePath}`
      };
    }
    
    const logContent = await fs.readFile(logFilePath, 'utf8');
    const logLines = logContent.trim().split('\n');
    
    if (logLines.length === 0) {
      return {
        success: false,
        message: 'Log file is empty'
      };
    }
    
    const lastEntry = JSON.parse(logLines[logLines.length - 1]);
    
    // Check if the log entry meets the expectations
    if (testCase.expectedLogCheck && !testCase.expectedLogCheck(lastEntry)) {
      return {
        success: false,
        message: `Log entry did not meet the expected criteria: ${JSON.stringify(lastEntry)}`
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
  console.log('🧪 Running Gemini API error handling tests...\n');
  
  // Setup test environment
  await setupTestEnvironment();
  
  let allTestsPassed = true;
  
  for (const testCase of TEST_CASES) {
    process.stdout.write(`Testing: ${testCase.name}... `);
    
    // Run bouncer with the test case
    const result = await runBouncerWithTestCase(testCase);
    
    // Check exit code
    const exitCodeCorrect = result.code === testCase.expectedExitCode;
    
    // Check error output
    const errorOutputCorrect = testCase.expectedErrorCheck ? 
      testCase.expectedErrorCheck(result.stderr) : true;
    
    // Check stdout if required
    const stdoutCorrect = testCase.expectedStdoutCheck ? 
      testCase.expectedStdoutCheck(result.stdout) : true;
    
    // Verify log file
    const logCheck = await verifyLogFile(testCase);
    
    if (exitCodeCorrect && errorOutputCorrect && stdoutCorrect && logCheck.success) {
      console.log('✅ PASSED');
    } else {
      allTestsPassed = false;
      console.log('❌ FAILED');
      
      if (!exitCodeCorrect) {
        console.log(`  Expected exit code ${testCase.expectedExitCode} but got ${result.code}`);
      }
      
      if (!errorOutputCorrect) {
        console.log(`  Error output did not meet expectations:`);
        console.log(`  ${result.stderr.trim()}`);
      }
      
      if (!stdoutCorrect && testCase.expectedStdoutCheck) {
        console.log(`  Stdout did not meet expectations:`);
        console.log(`  ${result.stdout.trim()}`);
      }
      
      if (!logCheck.success) {
        console.log(`  Log file issue: ${logCheck.message}`);
      }
    }
  }
  
  console.log('\n🏁 Test summary:');
  if (allTestsPassed) {
    console.log('All Gemini API error handling tests passed! ✨');
    return 0;
  } else {
    console.log('Some tests failed. Please review the errors above.');
    return 1;
  }
}

// Clean up the test environment
async function cleanupTestEnvironment() {
  try {
    // Remove the test directory
    rmSync(TEST_DIR, { recursive: true, force: true });
    console.log('\nTest environment cleaned up');
  } catch (error) {
    console.warn(`\nWarning: Could not clean up test environment: ${error.message}`);
  }
}

// Run the tests
runTests()
  .then(exitCode => {
    return cleanupTestEnvironment().then(() => process.exit(exitCode));
  })
  .catch(error => {
    console.error('Test runner error:', error);
    cleanupTestEnvironment().then(() => process.exit(1));
  });