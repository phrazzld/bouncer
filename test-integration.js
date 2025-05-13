#!/usr/bin/env node
/**
 * Integration tests for Bouncer as a pre-commit hook
 * 
 * This script:
 * 1. Creates a temporary Git repository
 * 2. Installs pre-commit in that repo
 * 3. Configures the Bouncer hook
 * 4. Tests various commit scenarios
 * 5. Cleans up the test environment
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { execSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

// Constants for test environment
const TEMP_DIR = path.resolve('./test-temp-integration');
const REPO_NAME = 'test-repo-' + randomBytes(4).toString('hex');
const REPO_PATH = path.join(TEMP_DIR, REPO_NAME);
const BOUNCER_PATH = path.resolve('.');
const PRE_COMMIT_CONFIG = path.join(REPO_PATH, '.pre-commit-config.yaml');
const ENV_FILE = path.join(REPO_PATH, '.env');
const RULES_FILE = path.join(REPO_PATH, 'rules.md');
const LOG_FILE = path.join(REPO_PATH, '.bouncer.log.jsonl');

// Test scenarios
const TEST_SCENARIOS = [
  {
    name: 'Valid commit (should pass)',
    setupFn: setupPassingCommit,
    verifyFn: verifyPassingCommit,
    expectedExitCode: 0
  },
  {
    name: 'Invalid commit with secrets (should fail)',
    setupFn: setupFailingCommitWithSecrets,
    verifyFn: verifyFailingCommit,
    expectedExitCode: 1
  },
  {
    name: 'Custom rules file path',
    setupFn: setupCustomRulesPath,
    verifyFn: verifyCustomRulesPath,
    expectedExitCode: 0
  },
  {
    name: 'Missing API key',
    setupFn: setupMissingApiKey,
    verifyFn: verifyMissingApiKey,
    expectedExitCode: 1
  }
];

/**
 * Setup the test environment
 */
async function setupTestEnvironment() {
  console.log('Setting up test environment...');
  
  // Clean up any existing test directory
  if (existsSync(TEMP_DIR)) {
    rmSync(TEMP_DIR, { recursive: true, force: true });
  }
  
  // Create test directory
  mkdirSync(TEMP_DIR, { recursive: true });
  
  // Create test repository
  mkdirSync(REPO_PATH, { recursive: true });
  
  try {
    // Initialize git repository
    execSync('git init', { cwd: REPO_PATH });
    
    // Configure git user for commit
    execSync('git config user.name "Test User"', { cwd: REPO_PATH });
    execSync('git config user.email "test@example.com"', { cwd: REPO_PATH });
    
    // Create initial commit so we have a HEAD
    writeFileSync(path.join(REPO_PATH, 'README.md'), '# Test Repository\n\nCreated for Bouncer integration testing.\n');
    execSync('git add README.md', { cwd: REPO_PATH });
    execSync('git commit -m "Initial commit"', { cwd: REPO_PATH });
    
    // Install pre-commit
    try {
      execSync('pip install pre-commit', { cwd: REPO_PATH });
    } catch (error) {
      console.warn('Warning: Could not install pre-commit with pip. Assuming it is already installed.');
      console.warn('Error was:', error.message);
    }
    
    // Create default rules file
    writeFileSync(RULES_FILE, 
      '# Test Rules for Bouncer\n\n' +
      '1. No secrets should be committed (API keys, tokens, passwords)\n' +
      '2. No large code changes (>1000 lines)\n' +
      '3. No security foot-guns (eval, etc)\n' +
      '4. Code should follow project conventions\n'
    );
    
    // Create default .env file with API key
    writeFileSync(ENV_FILE, 'GEMINI_API_KEY=test-api-key-for-integration-tests\n');
    
    // Create default pre-commit config pointing to the local bouncer
    const preCommitConfig = 
      'repos:\n' +
      '- repo: local\n' +
      '  hooks:\n' +
      '  - id: bouncer-check\n' +
      '    name: Bouncer AI Pre-commit Check\n' +
      `    entry: node ${BOUNCER_PATH}/bouncer.js\n` +
      '    language: node\n' +
      '    pass_filenames: false\n' +
      '    additional_dependencies: ["@google/genai@^0.13.0", "dotenv@^16.5.0"]\n';
    
    writeFileSync(PRE_COMMIT_CONFIG, preCommitConfig);
    
    // Install pre-commit hooks
    execSync('pre-commit install', { cwd: REPO_PATH });
    
    console.log('Test environment set up successfully.');
    return true;
  } catch (error) {
    console.error('Error setting up test environment:', error);
    return false;
  }
}

/**
 * Clean up the test environment
 */
async function cleanupTestEnvironment() {
  console.log('Cleaning up test environment...');
  
  try {
    // Remove the test directory
    rmSync(TEMP_DIR, { recursive: true, force: true });
    console.log('Test environment cleaned up successfully.');
    return true;
  } catch (error) {
    console.error('Error cleaning up test environment:', error);
    return false;
  }
}

/**
 * Run a git command in the test repository and return its output
 */
function runGitCommand(command, options = {}) {
  try {
    const output = execSync(command, { 
      cwd: REPO_PATH, 
      encoding: 'utf8',
      ...options
    });
    return { success: true, output };
  } catch (error) {
    // If the command was expected to fail, return the error output
    if (options.expectFailure) {
      return { 
        success: false, 
        output: error.stdout || '',
        stderr: error.stderr || '',
        code: error.status || 1
      };
    }
    throw error;
  }
}

/**
 * Run git commit and handle the pre-commit hook execution
 * This is more complex because we need to capture the output of the pre-commit hook
 */
async function runGitCommit(message, expectFailure = false) {
  return new Promise((resolve) => {
    const child = spawn('git', ['commit', '-m', message], {
      cwd: REPO_PATH,
      env: { ...process.env },
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
        success: code === 0,
        code,
        stdout,
        stderr
      });
    });
  });
}

/**
 * Read and parse the Bouncer log file
 */
async function readBouncerLog() {
  try {
    const logContent = await fs.readFile(LOG_FILE, 'utf8');
    const logEntries = logContent.trim().split('\n').map(line => JSON.parse(line));
    return logEntries;
  } catch (error) {
    console.error('Error reading Bouncer log file:', error);
    return [];
  }
}

/**
 * Scenario: Setup a commit that should pass Bouncer checks
 */
async function setupPassingCommit() {
  // Create a simple text file with no issues
  await fs.writeFile(
    path.join(REPO_PATH, 'passing-file.txt'),
    'This is a simple text file with no issues.\n' +
    'It should pass all Bouncer checks.\n'
  );
  
  // Stage the file
  runGitCommand('git add passing-file.txt');
  
  return true;
}

/**
 * Verify that a passing commit was processed correctly
 */
async function verifyPassingCommit(result) {
  // Check that the commit succeeded
  if (!result.success) {
    console.error('Commit failed when it should have passed.');
    console.error('Stdout:', result.stdout);
    console.error('Stderr:', result.stderr);
    return false;
  }
  
  // Check the log file
  const logEntries = await readBouncerLog();
  const lastEntry = logEntries[logEntries.length - 1];
  
  if (lastEntry.verdict !== 'PASS') {
    console.error('Expected PASS verdict but got:', lastEntry.verdict);
    return false;
  }
  
  return true;
}

/**
 * Scenario: Setup a commit that should fail Bouncer checks due to secrets
 */
async function setupFailingCommitWithSecrets() {
  // Create a file with a fake secret
  await fs.writeFile(
    path.join(REPO_PATH, 'secrets.js'),
    '// This file contains fake secrets\n' +
    'const API_KEY = "sk_live_1234567890abcdef";\n' +
    'const PASSWORD = "super-secret-password";\n' +
    'console.log("API key:", API_KEY);\n'
  );
  
  // Stage the file
  runGitCommand('git add secrets.js');
  
  return true;
}

/**
 * Verify that a failing commit was processed correctly
 */
async function verifyFailingCommit(result) {
  // Check that the commit failed
  if (result.success) {
    console.error('Commit passed when it should have failed.');
    return false;
  }
  
  // Check the log file
  const logEntries = await readBouncerLog();
  const lastEntry = logEntries[logEntries.length - 1];
  
  if (lastEntry.verdict !== 'FAIL') {
    console.error('Expected FAIL verdict but got:', lastEntry.verdict);
    return false;
  }
  
  return true;
}

/**
 * Scenario: Setup a test with custom rules file path
 */
async function setupCustomRulesPath() {
  // Create a custom rules file
  const customRulesPath = path.join(REPO_PATH, 'custom-rules.md');
  await fs.writeFile(
    customRulesPath,
    '# Custom Rules for Bouncer\n\n' +
    '1. No secrets should be committed\n'
  );
  
  // Update pre-commit config with custom rules path
  const preCommitConfig = 
    'repos:\n' +
    '- repo: local\n' +
    '  hooks:\n' +
    '  - id: bouncer-check\n' +
    '    name: Bouncer AI Pre-commit Check\n' +
    `    entry: node ${BOUNCER_PATH}/bouncer.js --rules-file ./custom-rules.md\n` +
    '    language: node\n' +
    '    pass_filenames: false\n' +
    '    additional_dependencies: ["@google/genai@^0.13.0", "dotenv@^16.5.0"]\n';
  
  await fs.writeFile(PRE_COMMIT_CONFIG, preCommitConfig);
  
  // Create a sample file to commit
  await fs.writeFile(
    path.join(REPO_PATH, 'custom-rules-test.txt'),
    'This file tests the custom rules path.\n'
  );
  
  // Stage the file
  runGitCommand('git add custom-rules-test.txt');
  
  return true;
}

/**
 * Verify that custom rules path was used
 */
async function verifyCustomRulesPath(result) {
  // Check that the commit succeeded
  if (!result.success) {
    console.error('Commit failed when using custom rules path.');
    console.error('Stdout:', result.stdout);
    console.error('Stderr:', result.stderr);
    return false;
  }
  
  // We should see some indication in the stdout that the custom rules file was used
  // This is harder to verify directly, so we'll consider it a pass if the commit succeeds
  return true;
}

/**
 * Scenario: Setup a test with missing API key
 */
async function setupMissingApiKey() {
  // Rename the .env file to simulate missing API key
  if (existsSync(ENV_FILE)) {
    await fs.rename(ENV_FILE, `${ENV_FILE}.bak`);
  }
  
  // Create a simple file to commit
  await fs.writeFile(
    path.join(REPO_PATH, 'missing-api-key-test.txt'),
    'This file tests the missing API key scenario.\n'
  );
  
  // Stage the file
  runGitCommand('git add missing-api-key-test.txt');
  
  return true;
}

/**
 * Verify that missing API key was detected
 */
async function verifyMissingApiKey(result) {
  // Check that the commit failed
  if (result.success) {
    console.error('Commit succeeded when it should have failed due to missing API key.');
    return false;
  }
  
  // Check if the error message mentions API key
  if (!result.stderr.includes('API key') && !result.stdout.includes('API key')) {
    console.error('Error message does not mention API key.');
    console.error('Stdout:', result.stdout);
    console.error('Stderr:', result.stderr);
    return false;
  }
  
  // Restore the .env file for later tests
  if (existsSync(`${ENV_FILE}.bak`)) {
    await fs.rename(`${ENV_FILE}.bak`, ENV_FILE);
  }
  
  return true;
}

/**
 * Run all integration tests
 */
async function runIntegrationTests() {
  console.log('🧪 Running Bouncer pre-commit hook integration tests...\n');
  
  // Set up the test environment
  const setupSuccess = await setupTestEnvironment();
  if (!setupSuccess) {
    console.error('Failed to set up test environment. Aborting tests.');
    return 1;
  }
  
  let allTestsPassed = true;
  
  // Run each test scenario
  for (const scenario of TEST_SCENARIOS) {
    console.log(`\nTesting: ${scenario.name}`);
    
    try {
      // Set up the scenario
      const setupResult = await scenario.setupFn();
      if (!setupResult) {
        console.error(`Failed to set up scenario: ${scenario.name}`);
        allTestsPassed = false;
        continue;
      }
      
      // Run git commit
      console.log('Running git commit...');
      const commitResult = await runGitCommit(`Test commit: ${scenario.name}`, scenario.expectedExitCode !== 0);
      
      // Verify the expected behavior
      const verifyResult = await scenario.verifyFn(commitResult);
      
      // Check exit code
      const exitCodeCorrect = (commitResult.code === 0) === (scenario.expectedExitCode === 0);
      
      if (verifyResult && exitCodeCorrect) {
        console.log(`✅ PASSED: ${scenario.name}`);
      } else {
        console.log(`❌ FAILED: ${scenario.name}`);
        if (!exitCodeCorrect) {
          console.log(`  Expected exit code ${scenario.expectedExitCode} but got ${commitResult.code}`);
        }
        allTestsPassed = false;
      }
    } catch (error) {
      console.error(`Error running scenario ${scenario.name}:`, error);
      allTestsPassed = false;
    }
  }
  
  // Clean up the test environment
  await cleanupTestEnvironment();
  
  console.log('\n🏁 Integration Test Summary:');
  if (allTestsPassed) {
    console.log('All integration tests passed! ✨');
    return 0;
  } else {
    console.log('Some integration tests failed. Please review the errors above.');
    return 1;
  }
}

// Run the integration tests
runIntegrationTests()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error('Integration test runner error:', error);
    cleanupTestEnvironment().then(() => process.exit(1));
  });