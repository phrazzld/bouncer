#!/usr/bin/env node
// Test script for API error handling in bouncer.js

console.log("Testing API error handling in bouncer.js");

// Test 1: Missing API Key
console.log("\nTest 1: Missing API Key");
console.log("1. Temporarily rename your .env file or set GEMINI_API_KEY to empty string");
console.log("2. Run: node ./bouncer.js");
console.log("3. Verify you get a clear error message about missing API key");
console.log("4. Restore your API key when done");

// Test 2: Invalid API Key
console.log("\nTest 2: Invalid API Key");
console.log("1. Set GEMINI_API_KEY to an invalid value (e.g., 'invalid-key')");
console.log("2. Run: node ./bouncer.js");
console.log("3. Verify you get an authentication error message");
console.log("4. Restore your valid API key when done");

// Test 3: Network Error (simulated)
console.log("\nTest 3: Network Error (manual simulation)");
console.log("1. Disconnect from the internet");
console.log("2. Run: node ./bouncer.js");
console.log("3. Verify you get a network error message");
console.log("4. Reconnect to the internet when done");

console.log("\nNote: Check that errors are logged in .bouncer.log.jsonl with 'ERROR' verdict");