#!/usr/bin/env node
/**
 * Test script for Git command error handling in bouncer.js
 * Tests various Git command error scenarios to ensure proper error messages and logging
 */
import fs from "node:fs/promises";
import path from "node:path";
import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";

// Constants
const TEST_DIR = path.resolve('./test-temp');
const TEST_ENV_FILE = path.join(TEST_DIR, '.env.test');
const TEST_EMPTY_REPO_DIR = path.join(TEST_DIR, 'empty-git-repo');

// Create a clean test environment
async function setupTestEnvironment() {
  // Remove existing test directory if it exists
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  
  // Create test directories
  mkdirSync(TEST_DIR, { recursive: true });
  mkdirSync(TEST_EMPTY_REPO_DIR, { recursive: true });
  
  // Create a test .env file with API key
  await fs.writeFile(
    TEST_ENV_FILE,
    'GEMINI_API_KEY=test-api-key-for-git-error-tests\n'
  );
  
  // Initialize an empty git repo
  execSync('git init', { cwd: TEST_EMPTY_REPO_DIR });
  
  console.log('Test environment created');
}

// Test cases for Git command error handling
const TEST_CASES = [
  {
    name: 'Not a Git repository',
    directory: TEST_DIR,
    // We'll set an environment variable to force a git error
    environmentOverrides: { GIT_DIR: '/definitely/not/a/git/repo' },
    expectedExitCode: 1,
    expectedErrorCheck: (stderr) => stderr.includes('fatal:') || stderr.includes('Repository error'),
    expectedLogCheck: (log) => log.verdict === 'ERROR' && log.reason && log.reason.includes('Git Command Error')
  },
  {
    name: 'No staged changes',
    directory: TEST_EMPTY_REPO_DIR,
    expectedExitCode: 1,
    expectedErrorCheck: (stderr) => stderr.includes('No staged changes found') || stderr.includes('No Changes error'),
    expectedLogCheck: (log) => log.verdict === 'ERROR' && log.reason && log.reason.includes('Git Command Error')
  }
];

// Function to run bouncer.js with specific test case
async function runBouncerWithTestCase(testCase) {
  return new Promise((resolve) => {
    // Set up environment
    const env = { 
      ...process.env, 
      GEMINI_API_KEY: 'test-api-key-for-git-error-tests'
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
        '--log-file', path.join(testCase.directory, '.bouncer.log.jsonl')
      ], 
      { 
        cwd: testCase.directory,
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
    const logFilePath = path.join(testCase.directory, '.bouncer.log.jsonl');
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
  console.log('🧪 Running Git command error handling tests...\n');
  
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
    const errorOutputCorrect = testCase.expectedErrorCheck(result.stderr);
    
    // Verify log file
    const logCheck = await verifyLogFile(testCase);
    
    if (exitCodeCorrect && errorOutputCorrect && logCheck.success) {
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
      
      if (!logCheck.success) {
        console.log(`  Log file issue: ${logCheck.message}`);
      }
    }
  }
  
  console.log('\n🏁 Test summary:');
  if (allTestsPassed) {
    console.log('All Git command error handling tests passed! ✨');
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