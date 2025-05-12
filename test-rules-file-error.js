#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';

// Create a clean test environment
async function setupTestEnvironment() {
  // Create temporary test directory if it doesn't exist
  const testDir = path.resolve('./test-temp');
  if (!existsSync(testDir)) {
    await fs.mkdir(testDir, { recursive: true });
  }
  
  // Create a temporary .env.test file
  try {
    await fs.writeFile(
      path.join(testDir, '.env.test'),
      'GEMINI_API_KEY=test-api-key-for-rules-file-error-tests\n'
    );
  } catch (error) {
    console.error('Error creating test environment file:', error);
    process.exit(1);
  }
}

// Test cases for rules file error handling
const TEST_CASES = [
  {
    name: 'Non-existent rules file',
    rulesFile: './test-temp/non-existent-rules.md',
    expectedErrorPattern: /Could not read rules file/i
  },
  {
    name: 'Unreadable rules file (no read permission)',
    rulesFile: './test-temp/unreadable-rules.md',
    setup: async () => {
      // Create a file with no read permissions
      const filePath = path.resolve('./test-temp/unreadable-rules.md');
      await fs.writeFile(filePath, 'This file should not be readable');
      try {
        // Try to set the file to be unreadable (may not work on all platforms)
        await fs.chmod(filePath, 0o000);
        return true;
      } catch (error) {
        console.warn('Warning: Could not make file unreadable. This test may be skipped.');
        return false;
      }
    },
    expectedErrorPattern: /Could not read rules file/i
  }
];

// Function to run bouncer.js with specific arguments
async function runWithRulesFile(rulesFile) {
  return new Promise((resolve) => {
    // Create environment variables
    const env = { 
      ...process.env, 
      GEMINI_API_KEY: 'test-api-key-for-rules-file-error-tests'
    };
    
    // Run bouncer.js with the test rules file
    const child = spawn(
      'node', 
      ['./bouncer.js', '--rules-file', rulesFile, '--env-file', './test-temp/.env.test'], 
      { 
        env,
        stdio: ['ignore', 'pipe', 'pipe'] 
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

// Function to verify log file contains the expected error entry
async function verifyLogEntry(testCase) {
  try {
    const logContent = await fs.readFile('./.bouncer.log.jsonl', 'utf8');
    const logLines = logContent.trim().split('\n');
    const lastEntry = JSON.parse(logLines[logLines.length - 1]);
    
    // For rules file errors, we expect an ERROR verdict
    if (lastEntry.verdict !== 'ERROR') {
      return {
        success: false,
        message: `Expected ERROR verdict but got ${lastEntry.verdict}`
      };
    }
    
    // Check if the reason contains Rules File Error
    if (!lastEntry.reason.includes('Rules File Error')) {
      return {
        success: false,
        message: `Expected 'Rules File Error' but got: ${lastEntry.reason}`
      };
    }
    
    // Check if the source matches our rules file path
    if (!lastEntry.source.includes(testCase.rulesFile.replace('./', ''))) {
      return {
        success: false,
        message: `Expected source to include ${testCase.rulesFile} but got: ${lastEntry.source}`
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
  console.log('🧪 Running rules file error handling tests...\n');
  
  // Setup test environment
  await setupTestEnvironment();
  console.log('Test environment created\n');
  
  let allTestsPassed = true;
  
  for (const testCase of TEST_CASES) {
    process.stdout.write(`Testing: ${testCase.name}... `);
    
    // Some tests require setup before running
    let shouldRunTest = true;
    if (testCase.setup) {
      shouldRunTest = await testCase.setup();
    }
    
    if (!shouldRunTest) {
      console.log('⏭️ SKIPPED (setup failed)');
      continue;
    }
    
    const result = await runWithRulesFile(testCase.rulesFile);
    
    // Check if the expected error pattern is in stderr
    const errorMatched = testCase.expectedErrorPattern.test(result.stderr);
    
    // For exit code, we expect 1 (error)
    const exitCodeCorrect = result.code === 1;
    
    // Verify log file too
    const logCheck = await verifyLogEntry(testCase);
    
    if (errorMatched && exitCodeCorrect && logCheck.success) {
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
      
      if (!logCheck.success) {
        console.log(`  Log file issue: ${logCheck.message}`);
      }
    }
  }
  
  console.log('\n🏁 Test summary:');
  if (allTestsPassed) {
    console.log('All rules file error handling tests passed! ✨');
    return 0;
  } else {
    console.log('Some tests failed. Please review the errors above.');
    return 1;
  }
}

// Clean up the test environment
async function cleanupTestEnvironment() {
  try {
    // Attempt to remove the test directory and its contents
    await fs.rm(path.resolve('./test-temp'), { recursive: true, force: true });
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