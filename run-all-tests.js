#!/usr/bin/env node
/**
 * Master test runner for bouncer.js
 * Runs all individual test files in sequence and reports overall results
 */
import { spawn } from "node:child_process";
import path from "node:path";

// Define all test files to run
const TEST_FILES = [
  "./test-api-key-validation.js",
  "./test-rules-file-error.js",
  "./test-git-errors.js",
  "./test-cli-args.js",
  "./test-exit-codes.js",
  "./test-gemini-api-errors.js",
  "./test-integration.js"
];

// Function to run a single test file
async function runTestFile(filePath) {
  return new Promise((resolve) => {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`Running: ${filePath}`);
    console.log(`${"-".repeat(80)}\n`);

    const child = spawn("node", [filePath], {
      stdio: "inherit" // Display output directly
    });

    child.on("close", (code) => {
      resolve({
        file: filePath,
        exitCode: code
      });
    });
  });
}

// Run all tests in sequence
async function runAllTests() {
  const results = [];
  
  for (const testFile of TEST_FILES) {
    const result = await runTestFile(testFile);
    results.push(result);
  }
  
  // Print summary
  console.log(`\n${"=".repeat(80)}`);
  console.log("TEST SUMMARY");
  console.log(`${"-".repeat(80)}`);
  
  let passedCount = 0;
  let failedCount = 0;
  
  for (const result of results) {
    const status = result.exitCode === 0 ? "✅ PASSED" : "❌ FAILED";
    if (result.exitCode === 0) {
      passedCount++;
    } else {
      failedCount++;
    }
    console.log(`${status}: ${result.file}`);
  }
  
  console.log(`\n${passedCount} passed, ${failedCount} failed`);
  
  // Return overall status
  return failedCount === 0 ? 0 : 1;
}

// Run the tests
runAllTests()
  .then((exitCode) => process.exit(exitCode))
  .catch((error) => {
    console.error("Test runner error:", error);
    process.exit(1);
  });