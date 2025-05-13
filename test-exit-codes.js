#!/usr/bin/env node
/**
 * Test script for exit codes in bouncer.js
 * Verifies that each error condition produces the correct exit code
 */
import { spawn } from "node:child_process";
import path from "node:path";

// Test cases for exit codes
const TEST_CASES = [
  {
    name: "Success",
    args: ["--help"],
    // Override process.exit in the child process
    environmentOverrides: { 
      TEST_EMPTY_DIFF: "true",
      TEST_FORCE_PASS: "true" 
    },
    expectedExitCode: 0
  },
  {
    name: "Failure (FAIL verdict)",
    args: ["--help"],
    environmentOverrides: { 
      TEST_EMPTY_DIFF: "true",
      TEST_FORCE_FAIL: "true" 
    },
    expectedExitCode: 1
  },
  {
    name: "Missing API key",
    args: ["--help"],
    environmentOverrides: { 
      GEMINI_API_KEY: "",
      // Clear all environment to ensure API key is really missing
      NODE_ENV: "test"
    },
    expectedExitCode: 1
  },
  {
    name: "Invalid API key",
    args: ["--help"],
    environmentOverrides: { 
      GEMINI_API_KEY: "too-short",
      NODE_ENV: "test"
    },
    expectedExitCode: 1
  },
  {
    name: "Rules file error",
    args: ["--rules-file", "/non-existent/rules.md"],
    environmentOverrides: {
      GEMINI_API_KEY: "test-api-key-long-enough-for-validation",
      NODE_ENV: "test"
    },
    expectedExitCode: 1
  },
  {
    name: "Gemini API error",
    args: ["--help"],
    environmentOverrides: {
      GEMINI_API_KEY: "test-api-key-long-enough-for-validation",
      TEST_EMPTY_DIFF: "true",
      TEST_SIMULATE_ERROR: "auth-401",
      NODE_ENV: "test"
    },
    expectedExitCode: 1
  },
  {
    name: "Git command error",
    args: ["--help"],
    // Force invalid git environment
    environmentOverrides: {
      GEMINI_API_KEY: "test-api-key-long-enough-for-validation", 
      GIT_DIR: "/not/a/git/repo"
    },
    expectedExitCode: 1
  }
];

// Function to run bouncer with test case
async function runBouncerWithTestCase(testCase) {
  return new Promise((resolve) => {
    // Prepare environment
    const env = {
      ...process.env,
      // Clear PATH to prevent loading any user git config
      ...testCase.environmentOverrides
    };

    // Run bouncer.js
    const child = spawn(
      "node",
      [path.resolve("./bouncer.js"), ...testCase.args],
      {
        env,
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      resolve({
        code,
        stdout,
        stderr
      });
    });
  });
}

// Run all tests
async function runTests() {
  console.log("🧪 Running exit code tests...\n");

  let passedCount = 0;
  let failedCount = 0;

  for (const testCase of TEST_CASES) {
    process.stdout.write(`Testing: ${testCase.name}... `);

    // Run bouncer with the test case
    const result = await runBouncerWithTestCase(testCase);

    // Check exit code
    if (result.code === testCase.expectedExitCode) {
      console.log("✅ PASSED");
      passedCount++;
    } else {
      console.log("❌ FAILED");
      console.log(`  Expected exit code ${testCase.expectedExitCode} but got ${result.code}`);
      console.log(`  Standard output: ${result.stdout.trim()}`);
      console.log(`  Error output: ${result.stderr.trim()}`);
      failedCount++;
    }
  }

  console.log(`\n🏁 Test summary: ${passedCount} passed, ${failedCount} failed`);
  return failedCount === 0 ? 0 : 1;
}

// Run the tests
runTests()
  .then((exitCode) => process.exit(exitCode))
  .catch((error) => {
    console.error("Test runner error:", error);
    process.exit(1);
  });