# T016 Plan: Implement Token Counting and Quota Tracking

## Objective
Enhance Bouncer's token handling by:
1. Using Gemini's countTokens API for accurate token counting rather than character-based estimation
2. Tracking and logging API quota usage for future reference and optimization

## Implementation Approach

### 1. Update Token Estimation to Use Actual Token Counts
- Replace the current character-based token estimation with direct calls to the countTokens API
- Modify the handlePotentiallyLargeDiff function to use precise token counts
- Ensure the function remains performant and handles errors gracefully

### 2. Add Quota and Usage Tracking
- Extract and log usage metadata from API responses
- Add usage statistics to the log entries for better tracking
- Consider adding a summary of token usage to console output

### 3. Update Constants and Configuration
- Remove or update existing constants related to character-based estimation
- Add new constants for token limits that reflect the API's actual constraints

## Code Changes

1. Update the token counting approach in handlePotentiallyLargeDiff:
```javascript
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
    return Math.ceil(text.length / AVERAGE_CHARS_PER_TOKEN);
  }
}

// Updated function to handle potentially large diffs using accurate token counts
async function handlePotentiallyLargeDiff(diff) {
  // Get accurate token count
  const tokenCount = await getTokenCount(diff);
  
  // If diff is within token limits, use it as is
  if (tokenCount <= TOKEN_LIMIT_THRESHOLD) {
    return { diff, tokenCount };
  }
  
  // Calculate how many characters to keep to stay under the threshold
  // Start with a conservative ratio, then adjust if needed
  const charRatio = diff.length / tokenCount;
  const safeCharLimit = Math.floor(TOKEN_LIMIT_THRESHOLD * charRatio * 0.95);
  
  // Truncate the diff with a warning marker
  const truncatedDiff = diff.substring(0, safeCharLimit);
  
  // Get token count of the truncated diff to verify we're under the limit
  const truncatedTokenCount = await getTokenCount(truncatedDiff);
  
  return { 
    diff: truncatedDiff + 
      "\n\n[TRUNCATED: Diff exceeds recommended limit of 800,000 tokens. " +
      `Showing first ${truncatedTokenCount} tokens. ` +
      `The complete diff was ${tokenCount} tokens in total.]`,
    tokenCount: truncatedTokenCount,
    originalTokenCount: tokenCount
  };
}
```

2. Update API call and logging to include usage metadata:
```javascript
// Call the Gemini API with the prompt
let res;
try {
  res = await AI.models.generateContent({
    model: "gemini-2.5-flash-preview-04-17",
    contents: prompt,
    config: { temperature: 0.1, candidateCount: 1 }
  });
  
  // Extract usage metadata
  const usageMetadata = res.usageMetadata;
  
  // Parse the response to determine the verdict (PASS or FAIL)
  const verdict = /PASS/i.test(res.text) ? "PASS" : "FAIL";
  
  // Log the verdict, response, and usage metadata to .bouncer.log.jsonl
  await fs.appendFile(
    ".bouncer.log.jsonl",
    JSON.stringify({
      ts: new Date().toISOString(),
      commit,
      verdict,
      reason: res.text,
      usage: {
        promptTokens: usageMetadata?.promptTokenCount || diffInfo.tokenCount || null,
        totalTokens: usageMetadata?.totalTokenCount || null,
      }
    }) + "\n"
  );
  
  // Display appropriate console output based on verdict and exit accordingly
  if (verdict === "FAIL") {
    console.error("\n🛑 Bouncer blocked this commit:\n" + res.text);
    if (usageMetadata) {
      console.info(`Token usage: ${usageMetadata.promptTokenCount} prompt, ${usageMetadata.totalTokenCount} total`);
    }
    process.exit(1); // Exit with error code for FAIL
  } else {
    console.log("✅ Bouncer PASS");
    if (usageMetadata) {
      console.info(`Token usage: ${usageMetadata.promptTokenCount} prompt, ${usageMetadata.totalTokenCount} total`);
    }
    // PASS verdict will exit with code 0 by default
  }
  
} catch (error) {
  // Error handling as already implemented
}
```

## Testing Plan
1. Test the token counting API with various inputs
2. Verify that large diffs are handled correctly with accurate token counts
3. Ensure token usage is logged properly in the .bouncer.log.jsonl file
4. Check that the appropriate console output is displayed with token usage information