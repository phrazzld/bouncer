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

// Constants for token limits
const TOKEN_LIMIT_THRESHOLD = 800000; // Conservative limit leaving buffer for prompt and rules
const FALLBACK_AVERAGE_CHARS_PER_TOKEN = 3.5; // Fallback for estimation if token counting fails

// Function to get accurate token count using Gemini API
async function getTokenCount(text) {
  try {
    const countTokensResponse = await AI.models.countTokens({
      model: "gemini-2.5-flash-preview-04-17",
      contents: text,
    });
    return countTokensResponse.totalTokens;
  } catch (error) {
    // If token counting fails, fall back to estimation
    console.warn("Warning: Token counting API failed, falling back to estimation");
    return Math.ceil(text.length / FALLBACK_AVERAGE_CHARS_PER_TOKEN);
  }
}

// Function to handle potentially large diffs by truncating if necessary
async function handlePotentiallyLargeDiff(diff) {
  // Get accurate token count
  const tokenCount = await getTokenCount(diff);

  // If diff is within token limits, use it as is
  if (tokenCount <= TOKEN_LIMIT_THRESHOLD) {
    return {
      diff,
      tokenCount,
      truncated: false
    };
  }

  // Calculate how many characters to keep based on tokens per character ratio
  const charRatio = diff.length / tokenCount;
  const safeCharLimit = Math.floor(TOKEN_LIMIT_THRESHOLD * charRatio * 0.95);

  // Truncate the diff with a warning marker
  const truncatedDiff = diff.substring(0, safeCharLimit);

  // Get token count of the truncated diff to verify we're under the limit
  const truncatedTokenCount = await getTokenCount(truncatedDiff);

  return {
    diff: truncatedDiff +
      "\n\n[TRUNCATED: Diff exceeds recommended limit of 800,000 tokens. " +
      `Showing first ${truncatedTokenCount} tokens of original ${tokenCount} tokens total. ` +
      `(Characters: ${truncatedDiff.length} of ${diff.length})]`,
    tokenCount: truncatedTokenCount,
    originalTokenCount: tokenCount,
    truncated: true
  };
}

// Retrieve the staged diff and handle potential truncation
const rawDiff = execSync("git diff --cached --unified=0", { encoding: "utf8" });
// Note: This returns a promise now that needs to be awaited
const diffInfo = await handlePotentiallyLargeDiff(rawDiff);

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
${diffInfo.diff}
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

  // Extract usage metadata if available
  const usageMetadata = res.usageMetadata;

  // Parse the response to determine the verdict (PASS or FAIL)
  const verdict = /PASS/i.test(res.text) ? "PASS" : "FAIL";

  // Prepare token usage information for logging
  const tokenUsage = {
    inputTokens: usageMetadata?.promptTokenCount || diffInfo.tokenCount || null,
    outputTokens: usageMetadata?.candidatesTokenCount || null,
    totalTokens: usageMetadata?.totalTokenCount || null,
    diffTokens: diffInfo.tokenCount,
    truncated: diffInfo.truncated || false
  };

  if (diffInfo.truncated) {
    tokenUsage.originalDiffTokens = diffInfo.originalTokenCount;
  }

  // Log the verdict, response, and usage metadata to .bouncer.log.jsonl
  await fs.appendFile(
    ".bouncer.log.jsonl",
    JSON.stringify({
      ts: new Date().toISOString(),
      commit,
      verdict,
      reason: res.text,
      usage: tokenUsage
    }) + "\n"
  );

  // Display appropriate console output based on verdict and exit accordingly
  if (verdict === "FAIL") {
    console.error("\n🛑 Bouncer blocked this commit:\n" + res.text);

    // Display token usage information
    if (tokenUsage.totalTokens) {
      console.info(`\nToken usage: ${tokenUsage.inputTokens} input, ${tokenUsage.outputTokens} output (${tokenUsage.totalTokens} total)`);
    }
    if (diffInfo.truncated) {
      console.info(`Diff truncated: ${diffInfo.tokenCount} of ${diffInfo.originalTokenCount} tokens included`);
    }

    process.exit(1); // Exit with error code for FAIL
  } else {
    console.log("✅ Bouncer PASS");

    // Display token usage information
    if (tokenUsage.totalTokens) {
      console.info(`\nToken usage: ${tokenUsage.inputTokens} input, ${tokenUsage.outputTokens} output (${tokenUsage.totalTokens} total)`);
    }
    if (diffInfo.truncated) {
      console.info(`Diff truncated: ${diffInfo.tokenCount} of ${diffInfo.originalTokenCount} tokens included`);
    }

    // PASS verdict will exit with code 0 by default
  }

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

  // Log the error to the audit trail with token count information
  await fs.appendFile(
    ".bouncer.log.jsonl",
    JSON.stringify({
      ts: new Date().toISOString(),
      commit,
      verdict: "ERROR",
      reason: `API Error: ${error.message || 'Unknown error'}`,
      usage: {
        diffTokens: diffInfo.tokenCount,
        truncated: diffInfo.truncated || false,
        ...(diffInfo.truncated && { originalDiffTokens: diffInfo.originalTokenCount })
      }
    }) + "\n"
  );

  // Exit with error code
  process.exit(1);
}