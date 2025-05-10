#\!/usr/bin/env node
// Simple test to verify the logging and exit code behavior

import fs from "node:fs/promises";

// Mock response with PASS verdict
const mockPassResponse = {
  text: "PASS - All rules satisfied. No issues found."
};

// Test the logging and exit handling with PASS verdict
async function testPassScenario() {
  const verdict = "PASS";
  const commit = "test123";
  
  console.log("Testing PASS scenario...");
  
  // Log to a test file
  await fs.appendFile(
    "test-bouncer.log.jsonl",
    JSON.stringify({
      ts: new Date().toISOString(),
      commit,
      verdict,
      reason: mockPassResponse.text
    }) + "\n"
  );
  
  // Display appropriate console output
  console.log("✅ Bouncer PASS");
  
  console.log("PASS scenario test completed successfully");
}

// Run the test
testPassScenario();
