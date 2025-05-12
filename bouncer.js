#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

/**
 * Parse command line arguments from process.argv
 * Supports both flag arguments (--flag) and key-value pairs (--key value)
 * @returns {Object} Object containing parsed arguments
 */
function parseArguments() {
  const args = {};
  const argv = process.argv.slice(2); // Remove 'node' and script name

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    // Check if argument is a flag/key (starts with --)
    if (arg.startsWith('--')) {
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

  return args;
}

// Parse command line arguments
const cliArgs = parseArguments();

// Determine env file path (use CLI arg or default)
const envFilePath = cliArgs["env-file"]
  ? path.resolve(cliArgs["env-file"])
  : path.resolve("./.env");

// Load environment variables from the specified file
try {
  const result = dotenv.config({ path: envFilePath });

  if (result.error) {
    throw result.error;
  }
} catch (error) {
  // Only warn if file doesn't exist - it's common to rely on system environment variables instead
  if (error.code === 'ENOENT') {
    console.warn(`\n⚠️ Warning: Environment file not found at ${envFilePath}`);
    console.warn("Will use system environment variables only.");
  } else {
    console.error(`\n🔑 Error: Could not load environment file at ${envFilePath}`);
    console.error(`${error.message}`);
    console.error("Please ensure the environment file exists and is readable.");
  }
}

// Check if API key exists and validate
if (!process.env.GEMINI_API_KEY) {
  console.error("\n🔑 Error: Missing Gemini API key");
  console.error(`Tried loading from: ${envFilePath}`);
  console.error("Please add your API key to your .env file: GEMINI_API_KEY=your_key_here");
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

// Determine rules file path (use CLI arg or default)
const rulesFilePath = cliArgs["rules-file"]
  ? path.resolve(cliArgs["rules-file"])
  : path.resolve("./rules.md");

// Determine log file path (use CLI arg or default)
const logFilePath = cliArgs["log-file"]
  ? path.resolve(cliArgs["log-file"])
  : path.resolve("./.bouncer.log.jsonl");

// Read rules from the specified file
let rules;
try {
  rules = await fs.readFile(rulesFilePath, "utf8");
} catch (error) {
  console.error(`\n📄 Error: Could not read rules file at ${rulesFilePath}`);
  console.error(`${error.message}`);
  console.error("Please ensure the rules file exists and is readable");
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

  // Log the verdict, response, and usage metadata to the configured log file
  try {
    await fs.appendFile(
      logFilePath,
      JSON.stringify({
        ts: new Date().toISOString(),
        commit,
        verdict,
        reason: res.text,
        usage: tokenUsage
      }) + "\n"
    );
  } catch (error) {
    console.warn(`\n⚠️ Warning: Could not write to log file at ${logFilePath}`);
    console.warn(`Error: ${error.message}`);
  }

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
  try {
    await fs.appendFile(
      logFilePath,
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
  } catch (logError) {
    console.warn(`\n⚠️ Warning: Could not write to log file at ${logFilePath}`);
    console.warn(`Error: ${logError.message}`);
  }

  // Exit with error code
  process.exit(1);
}