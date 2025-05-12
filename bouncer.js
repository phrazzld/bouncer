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

// Determine file paths from CLI args or defaults
const envFilePath = cliArgs["env-file"]
  ? path.resolve(cliArgs["env-file"])
  : path.resolve("./.env");

const rulesFilePath = cliArgs["rules-file"]
  ? path.resolve(cliArgs["rules-file"])
  : path.resolve("./rules.md");

const logFilePath = cliArgs["log-file"]
  ? path.resolve(cliArgs["log-file"])
  : path.resolve("./.bouncer.log.jsonl");

/**
 * Log API key error and exit
 * @param {string} errorMessage - The error message to log
 * @param {string[]} consoleMessages - Additional messages to display on console
 */
async function handleApiKeyError(errorMessage, consoleMessages) {
  console.error(`\n🔑 Error: ${errorMessage}`);
  console.error(`Tried loading from: ${envFilePath}`);

  // Display additional console messages if provided
  if (consoleMessages && consoleMessages.length) {
    consoleMessages.forEach(msg => console.error(msg));
  }

  // Log the error to the configured log file
  try {
    await fs.appendFile(
      logFilePath,
      JSON.stringify({
        ts: new Date().toISOString(),
        commit: "<api-key-error>",
        verdict: "ERROR",
        reason: `API Key Error: ${errorMessage}`,
        source: envFilePath
      }) + "\n"
    );
  } catch (logError) {
    console.warn(`\n⚠️ Warning: Could not write to log file at ${logFilePath}`);
    console.warn(`Error: ${logError.message}`);
  }

  process.exit(1);
}

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
  await handleApiKeyError(
    "Missing Gemini API key",
    [
      "Please add your API key to your .env file: GEMINI_API_KEY=your_key_here",
      "Or set it as an environment variable before running the script."
    ]
  );
} else if (process.env.GEMINI_API_KEY.trim() === "") {
  await handleApiKeyError(
    "Empty Gemini API key",
    [
      "Your API key is empty. Please provide a valid Gemini API key.",
      "Add it to your .env file: GEMINI_API_KEY=your_key_here"
    ]
  );
} else if (process.env.GEMINI_API_KEY.length < 20) {
  // Gemini API keys are typically long; this is a simple check for obviously invalid keys
  await handleApiKeyError(
    "Gemini API key appears to be invalid (too short)",
    [
      "Your API key appears to be invalid. Please check that you have the correct Gemini API key.",
      "You can generate a new API key at https://aistudio.google.com/app/apikey"
    ]
  );
}

const AI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Constants for token limits
const TOKEN_LIMIT_THRESHOLD = 800000; // Conservative limit leaving buffer for prompt and rules
const FALLBACK_AVERAGE_CHARS_PER_TOKEN = 3.5; // Fallback for estimation if token counting fails

/**
 * Log Gemini API error and exit
 * @param {string} operation - The API operation that failed (e.g., "content generation", "token counting")
 * @param {Error} error - The error object from the API
 * @param {Object} metadata - Additional metadata to include in the log
 * @param {boolean} shouldExit - Whether to exit the process (default: true)
 */
async function handleGeminiApiError(operation, error, metadata = {}, shouldExit = true) {
  console.error(`\n❌ Error calling Gemini API (${operation}):`);

  let errorType = "Unknown";
  let errorMessage = "";
  let suggestedAction = "";

  // Categorize the error and provide helpful messages
  if (error.status) {
    // API responded with an error status
    if (error.status === 401 || error.status === 403) {
      errorType = "Authentication";
      errorMessage = "Invalid API key or insufficient permissions.";
      suggestedAction = "Check your Gemini API key and ensure it has proper permissions.";
    } else if (error.status === 429) {
      errorType = "Rate Limit";
      errorMessage = "Rate limit or quota exceeded for Gemini API.";
      suggestedAction = "Try again later or check your API usage limits at https://aistudio.google.com/app/apikey.";
    } else if (error.status >= 500) {
      errorType = "Server";
      errorMessage = "Gemini API is currently experiencing issues.";
      suggestedAction = "Please try again later when the service is stable.";
    } else {
      errorType = `API (${error.status})`;
      errorMessage = error.message || 'Unknown error';
      suggestedAction = "Check the error message for details or try again later.";
    }
  } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    // Network error
    errorType = "Network";
    errorMessage = "Could not connect to Gemini API.";
    suggestedAction = "Check your internet connection and try again.";
  } else if (error.code === 'ETIMEDOUT') {
    // Timeout error
    errorType = "Timeout";
    errorMessage = "The Gemini API is taking too long to respond.";
    suggestedAction = "Try again later when the service might be less busy.";
  } else if (error.message && error.message.includes("quota")) {
    // Quota error - look for messaging about quotas in the error
    errorType = "Quota";
    errorMessage = "Your Gemini API quota has been exceeded.";
    suggestedAction = "Check your quota limits at https://aistudio.google.com/app/apikey.";
  } else {
    // Unexpected error
    errorType = "Unexpected";
    errorMessage = error.message || String(error);
    suggestedAction = "Check your configuration and try again.";
  }

  // Display the error information
  console.error(`${errorType} error: ${errorMessage}`);
  console.error(`Suggested action: ${suggestedAction}`);

  // Log the error to the configured log file
  try {
    await fs.appendFile(
      logFilePath,
      JSON.stringify({
        ts: new Date().toISOString(),
        commit: metadata.commit || "<gemini-api-error>",
        verdict: "ERROR",
        reason: `Gemini API Error: ${errorType} - ${errorMessage}`,
        operation: operation,
        error: {
          type: errorType,
          message: errorMessage,
          code: error.code,
          status: error.status
        },
        ...metadata
      }) + "\n"
    );
  } catch (logError) {
    console.warn(`\n⚠️ Warning: Could not write to log file at ${logFilePath}`);
    console.warn(`Error: ${logError.message}`);
  }

  // Exit if required
  if (shouldExit) {
    process.exit(1);
  }
}

// Function to get accurate token count using Gemini API
async function getTokenCount(text) {
  try {
    const countTokensResponse = await AI.models.countTokens({
      model: "gemini-2.5-flash-preview-04-17",
      contents: text,
    });
    return countTokensResponse.totalTokens;
  } catch (error) {
    // If token counting fails, log the error but don't exit
    await handleGeminiApiError("token counting", error, {}, false);

    // Fall back to estimation
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

/**
 * Log rules file error and exit
 * @param {string} errorMessage - The error message to log
 * @param {Error} originalError - The original error object
 * @param {string[]} consoleMessages - Additional messages to display on console
 */
async function handleRulesFileError(errorMessage, originalError, consoleMessages) {
  console.error(`\n📄 Error: ${errorMessage}`);
  console.error(`Source: ${rulesFilePath}`);
  console.error(`Details: ${originalError.message}`);

  // Display additional console messages if provided
  if (consoleMessages && consoleMessages.length) {
    consoleMessages.forEach(msg => console.error(msg));
  }

  // Log the error to the configured log file
  try {
    await fs.appendFile(
      logFilePath,
      JSON.stringify({
        ts: new Date().toISOString(),
        commit: "<rules-file-error>",
        verdict: "ERROR",
        reason: `Rules File Error: ${errorMessage}`,
        error: originalError.message,
        source: rulesFilePath
      }) + "\n"
    );
  } catch (logError) {
    console.warn(`\n⚠️ Warning: Could not write to log file at ${logFilePath}`);
    console.warn(`Error: ${logError.message}`);
  }

  process.exit(1);
}

// Read rules from the specified file
let rules;
try {
  rules = await fs.readFile(rulesFilePath, "utf8");
} catch (error) {
  await handleRulesFileError(
    "Could not read rules file",
    error,
    [
      "Please ensure the rules file exists and is readable.",
      "The rules file defines the criteria Bouncer uses to evaluate commits."
    ]
  );
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
  // Handle the API error with our centralized error handler
  // Include diffInfo in the metadata for logging
  await handleGeminiApiError("content generation", error, {
    commit,
    usage: {
      diffTokens: diffInfo.tokenCount,
      truncated: diffInfo.truncated || false,
      ...(diffInfo.truncated && { originalDiffTokens: diffInfo.originalTokenCount })
    }
  });

  // handleGeminiApiError will exit the process, so no code after this will execute
}