#!/usr/bin/env node
import fs from "node:fs/promises";
import { execSync } from "node:child_process";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

// Check if API key exists and validate
if (!process.env.GEMINI_API_KEY) {
  console.error("\n🔑 Error: Missing Gemini API key");
  console.error("Please add your API key to .env file: GEMINI_API_KEY=your_key_here");
  console.error("Or set it as an environment variable before running the script.");
  process.exit(1);
}

const AI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Constants for token estimation and handling large diffs
const AVERAGE_CHARS_PER_TOKEN = 3.5;
const TOKEN_LIMIT_THRESHOLD = 800000; // Conservative limit leaving buffer for prompt and rules

// Function to handle potentially large diffs by truncating if necessary
function handlePotentiallyLargeDiff(diff) {
  // Rough estimation of tokens based on character count
  const estimatedTokens = Math.ceil(diff.length / AVERAGE_CHARS_PER_TOKEN);
  
  // If diff is within token limits, use it as is
  if (estimatedTokens <= TOKEN_LIMIT_THRESHOLD) {
    return diff;
  }
  
  // Calculate how many characters to keep (with some safety margin)
  const safeCharLimit = Math.floor(TOKEN_LIMIT_THRESHOLD * AVERAGE_CHARS_PER_TOKEN * 0.95);
  
  // Truncate the diff with a warning marker
  const truncatedDiff = diff.substring(0, safeCharLimit);
  return truncatedDiff + 
    "\n\n[TRUNCATED: Diff exceeds recommended limit of 800,000 tokens. " +
    `Showing first ${safeCharLimit} characters (approximately ${Math.floor(TOKEN_LIMIT_THRESHOLD * 0.95)} tokens). ` +
    "The complete diff was " + diff.length + " characters in total.]";
}

// Retrieve the staged diff and handle potential truncation
const rawDiff = execSync("git diff --cached --unified=0", { encoding: "utf8" });
const diff = handlePotentiallyLargeDiff(rawDiff);

// Retrieve the current commit hash
let commit;
try {
  commit = execSync("git rev-parse --verify HEAD", { encoding: "utf8" }).trim();
} catch (error) {
  // Handle case where there's no commit history yet
  commit = "<new>";
}

// Read rules from rules.md
let rules;
try {
  rules = await fs.readFile(new URL("./rules.md", import.meta.url), "utf8");
} catch (error) {
  console.error("\n📄 Error: Could not read rules.md file");
  console.error(`${error.message}`);
  console.error("Please ensure rules.md exists in the same directory as bouncer.js");
  process.exit(1);
}

// Construct the prompt according to the format in PLAN.md
const prompt = `SYSTEM:
You are *Bouncer*, an uncompromising reviewer.
Enforce the following rules:
${rules}

USER:
Commit ${commit} diff:
${diff}
Return exactly:
PASS – if all rules satisfied
or
FAIL – if any rule violated
And give a brief justification (<40 words).`;

// Call the Gemini API with the prompt
let res;
try {
  res = await AI.models.generateContent({
    model: "gemini-2.5-flash-preview-04-17",
    contents: prompt,
    config: { temperature: 0.1, candidateCount: 1 }
  });
} catch (error) {
  // Handle different error types
  console.error("\n❌ Error calling Gemini API:");

  if (error.status) {
    // API responded with an error status
    if (error.status === 401 || error.status === 403) {
      console.error("Authentication error: Invalid API key or insufficient permissions.");
      console.error("Please check your Gemini API key and ensure it has proper permissions.");
    } else if (error.status >= 500) {
      console.error("Gemini API is currently experiencing issues. Please try again later.");
    } else {
      console.error(`API error (${error.status}): ${error.message || 'Unknown error'}`);
    }
  } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    // Network error
    console.error("Network error: Could not connect to Gemini API.");
    console.error("Please check your internet connection and try again.");
  } else if (error.code === 'ETIMEDOUT') {
    // Timeout error
    console.error("Request timed out. The Gemini API is taking too long to respond.");
    console.error("Please try again later when the service might be less busy.");
  } else {
    // Unexpected error
    console.error(`Unexpected error: ${error.message || error}`);
  }

  // Log the error to the audit trail
  await fs.appendFile(
    ".bouncer.log.jsonl",
    JSON.stringify({
      ts: new Date().toISOString(),
      commit,
      verdict: "ERROR",
      reason: `API Error: ${error.message || 'Unknown error'}`
    }) + "\n"
  );

  // Exit with error code
  process.exit(1);
}

// Parse the response to determine the verdict (PASS or FAIL)
const verdict = /PASS/i.test(res.text) ? "PASS" : "FAIL";

// Log the verdict and response to .bouncer.log.jsonl
await fs.appendFile(
  ".bouncer.log.jsonl",
  JSON.stringify({
    ts: new Date().toISOString(),
    commit,
    verdict,
    reason: res.text
  }) + "\n"
);

// Display appropriate console output based on verdict and exit accordingly
if (verdict === "FAIL") {
  console.error("\n🛑 Bouncer blocked this commit:\n" + res.text);
  process.exit(1); // Exit with error code for FAIL
} else {
  console.log("✅ Bouncer PASS");
  // PASS verdict will exit with code 0 by default
}