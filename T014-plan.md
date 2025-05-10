# T014 Plan: Handle Large Diffs by Truncating Input

## Context and Considerations

Before implementing truncation, we need to understand the realistic limits:

- According to PLAN.md, Gemini 2.5 Flash has a context window of 1,048,576 input tokens
- The average English text translates to about 3-4 characters per token
- This means we can handle roughly 3-4 million characters in the diff
- For safety, we should set a conservative threshold well below this limit
- We need to detect when a diff exceeds our threshold and handle it appropriately

## Steps

1. Define an appropriate token limit threshold (e.g., 800,000 tokens to leave room for rules and prompt)
2. Implement logic to estimate token count from character count (a simple estimation method)
3. Detect when a diff exceeds our threshold
4. Implement truncation with clear context markers when needed
5. Test the implementation with a very large diff

## Implementation Approach

```javascript
// Constants for token estimation
const AVERAGE_CHARS_PER_TOKEN = 3.5;
const TOKEN_LIMIT_THRESHOLD = 800000; // Conservative limit leaving buffer for prompt and rules

// Logic to detect and handle large diffs
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
    `Showing first ${safeCharLimit} characters (approximately ${TOKEN_LIMIT_THRESHOLD * 0.95} tokens). ` +
    "The complete diff was " + diff.length + " characters in total.]";
}
```

This approach:
1. Makes a conservative estimate of tokens based on characters
2. Only truncates when absolutely necessary (well over 2 million characters)
3. Adds a clear marker at the truncation point
4. Includes meta-information about the truncation for transparency

## Modifications to bouncer.js

We'll modify bouncer.js to use this function when processing the git diff:

```javascript
// Retrieve the staged diff and handle potential truncation
const rawDiff = execSync("git diff --cached --unified=0", { encoding: "utf8" });
const diff = handlePotentiallyLargeDiff(rawDiff);
```

## Testing Strategy

To test this implementation, we'll:
1. Create a temporary file with a very large content (over the threshold)
2. Stage it and run our function to verify truncation works
3. Check that the truncation message is included and correct
4. Verify we're staying well under Gemini's actual token limits