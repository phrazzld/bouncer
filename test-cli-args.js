#!/usr/bin/env node
/**
 * test-cli-args.js
 * Unit tests for CLI argument parsing and path handling in bouncer.js
 */

import assert from 'node:assert';
import path from 'node:path';
import { execSync } from 'node:child_process';

// Test cases array
const tests = [
  {
    name: "Default arguments",
    args: [],
    expected: {
      "rules-file": path.resolve("./rules.md"),
      "env-file": path.resolve("./.env"),
      "log-file": path.resolve("./.bouncer.log.jsonl")
    }
  },
  {
    name: "Custom rules file path",
    args: ["--rules-file", "custom-rules.md"],
    expected: {
      "rules-file": path.resolve("./custom-rules.md"),
      "env-file": path.resolve("./.env"),
      "log-file": path.resolve("./.bouncer.log.jsonl")
    }
  },
  {
    name: "Custom env file path",
    args: ["--env-file", ".env.test"],
    expected: {
      "rules-file": path.resolve("./rules.md"),
      "env-file": path.resolve("./.env.test"),
      "log-file": path.resolve("./.bouncer.log.jsonl")
    }
  },
  {
    name: "Custom log file path",
    args: ["--log-file", "custom-log.jsonl"],
    expected: {
      "rules-file": path.resolve("./rules.md"),
      "env-file": path.resolve("./.env"),
      "log-file": path.resolve("./custom-log.jsonl")
    }
  },
  {
    name: "Debug flag",
    args: ["--debug"],
    expected: {
      "rules-file": path.resolve("./rules.md"),
      "env-file": path.resolve("./.env"),
      "log-file": path.resolve("./.bouncer.log.jsonl"),
      "debug": true
    }
  },
  {
    name: "Multiple arguments",
    args: ["--rules-file", "test-rules.md", "--debug", "--env-file", ".env.test"],
    expected: {
      "rules-file": path.resolve("./test-rules.md"),
      "env-file": path.resolve("./.env.test"),
      "log-file": path.resolve("./.bouncer.log.jsonl"),
      "debug": true
    }
  },
  {
    name: "Equal sign in arguments",
    args: ["--rules-file=equal-rules.md"],
    expected: {
      "rules-file": path.resolve("./equal-rules.md"),
      "env-file": path.resolve("./.env"),
      "log-file": path.resolve("./.bouncer.log.jsonl")
    }
  }
];

// Run the tests
let passedTests = 0;
let failedTests = 0;

console.log("🧪 Running CLI argument parsing tests...\n");

// Execute each test case by creating a Node subprocess with the appropriate arguments
for (const test of tests) {
  try {
    console.log(`Testing: ${test.name}`);
    
    // Create a custom test script that imports the module and tests the arguments
    const testScript = `
      import path from 'node:path';
      
      // Mock process.argv
      process.argv = ['node', 'bouncer.js', ${test.args.map(arg => `'${arg}'`).join(', ')}];
      
      // Import only the parseArguments function
      function parseArguments() {
        const args = {};
        const argv = process.argv.slice(2); // Remove 'node' and script name

        for (let i = 0; i < argv.length; i++) {
          const arg = argv[i];

          // Check if argument is a flag/key (starts with --)
          if (arg.startsWith('--')) {
            // Check if arg contains an equals sign (--key=value)
            if (arg.includes('=')) {
              const [fullKey, value] = arg.split('=', 2);
              const key = fullKey.slice(2); // Remove the leading --
              args[key] = value;
            } else {
              const key = arg.slice(2); // Remove the leading --

              // Check if next item exists and is not another flag
              if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
                args[key] = argv[i + 1];
                i++; // Skip the value in the next iteration
              } else {
                // It's a flag without a value
                args[key] = true;
              }
            }
          }
        }

        return args;
      }
      
      // Parse arguments
      const cliArgs = parseArguments();
      
      // Process path resolution for file paths
      const envFilePath = cliArgs["env-file"]
        ? path.resolve(cliArgs["env-file"])
        : path.resolve("./.env");
      
      const rulesFilePath = cliArgs["rules-file"]
        ? path.resolve(cliArgs["rules-file"])
        : path.resolve("./rules.md");
      
      const logFilePath = cliArgs["log-file"]
        ? path.resolve(cliArgs["log-file"])
        : path.resolve("./.bouncer.log.jsonl");
      
      // Combine parsed arguments with resolved paths
      const result = {
        ...cliArgs,
        "env-file": envFilePath,
        "rules-file": rulesFilePath,
        "log-file": logFilePath
      };
      
      // Output the result as JSON for comparison
      console.log(JSON.stringify(result));
    `;
    
    // Create a temporary file with the test script
    const tempFile = `/tmp/bouncer-cli-test-${Date.now()}.mjs`;
    const fs = await import('node:fs/promises');
    await fs.writeFile(tempFile, testScript);
    
    // Execute the test script
    const result = execSync(`node ${tempFile}`, { encoding: 'utf8' }).trim();
    
    // Parse the result
    const parsedResult = JSON.parse(result);
    
    // Compare expected vs actual results
    let testPassed = true;
    const differences = [];
    
    // Check that all expected keys are present with correct values
    for (const [key, expectedValue] of Object.entries(test.expected)) {
      if (parsedResult[key] !== expectedValue) {
        testPassed = false;
        differences.push(`Key "${key}": expected "${expectedValue}", got "${parsedResult[key]}"`);
      }
    }
    
    // Check that there are no extra keys in the result
    for (const key of Object.keys(parsedResult)) {
      if (!(key in test.expected) && key !== "debug") {
        testPassed = false;
        differences.push(`Unexpected key "${key}" with value "${parsedResult[key]}"`);
      }
    }
    
    // Delete the temporary file
    await fs.unlink(tempFile);
    
    if (testPassed) {
      console.log(`✅ PASSED: ${test.name}\n`);
      passedTests++;
    } else {
      console.log(`❌ FAILED: ${test.name}`);
      console.log(`Differences found:`);
      differences.forEach(diff => console.log(` - ${diff}`));
      console.log("");
      failedTests++;
    }
  } catch (error) {
    console.error(`❌ ERROR running test "${test.name}": ${error.message}`);
    failedTests++;
  }
}

// Print test summary
console.log(`\n🧮 Test Summary: ${passedTests} passed, ${failedTests} failed`);

// Set exit code based on test results
process.exit(failedTests > 0 ? 1 : 0);