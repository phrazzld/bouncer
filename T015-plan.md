# T015 Plan: Handle API Outage or Missing Key Gracefully

## Objective
Improve the error handling in bouncer.js to gracefully handle cases where:
1. The Gemini API key is missing or invalid
2. The Gemini API is experiencing an outage
3. Any other API-related errors occur

## Implementation Approach

### 1. API Key Validation
- Add a check at the start of the script to verify if the Gemini API key exists in the environment
- If missing, provide a clear error message with instructions on how to set up the key

### 2. Try/Catch Around API Calls
- Wrap the Gemini API call in a try/catch block to handle potential errors
- Identify different error types (auth errors, network errors, timeout, etc.)
- Provide specific, actionable error messages for each case

### 3. Configurable Behavior
- Implement a default behavior of hard-fail (exit with code 1) for API failures
- Consider adding a configuration option in the future to allow warnings instead

## Code Changes

1. Add API key validation at initialization:
```javascript
// Check if API key exists
if (!process.env.GEMINI_API_KEY) {
  console.error("\n🔑 Error: Missing Gemini API key");
  console.error("Please add your API key to .env file: GEMINI_API_KEY=your_key_here");
  console.error("Or set it as an environment variable before running the script.");
  process.exit(1);
}

const AI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```

2. Wrap API call in try/catch with error handling:
```javascript
// Call the Gemini API with the prompt
let res;
try {
  res = await AI.models.generateContent({
    model: "gemini-2.5-flash-preview-04-17",
    contents: prompt,
    config: { temperature: 0.1, candidateCount: 1 }
  });
} catch (error) {
  // Handle different error cases
  console.error("\n❌ Error calling Gemini API:");
  
  if (error.response) {
    // API responded with an error status
    const status = error.response.status;
    if (status === 401 || status === 403) {
      console.error("Authentication error: Invalid API key or insufficient permissions.");
      console.error("Please check your Gemini API key and ensure it has proper permissions.");
    } else if (status >= 500) {
      console.error("Gemini API is currently experiencing issues. Please try again later.");
    } else {
      console.error(`Error ${status}: ${error.message}`);
    }
  } else if (error.request) {
    // Network error or timeout
    console.error("Network error: Could not connect to Gemini API.");
    console.error("Please check your internet connection and try again.");
  } else {
    // Unexpected error
    console.error(`Unexpected error: ${error.message}`);
  }
  
  // Exit with error code
  process.exit(1);
}
```

## Testing Plan
1. Test with missing API key (blank or deleted from .env)
2. Test with invalid API key
3. Test with simulated network errors (if possible)
4. Ensure error messages are clear and actionable