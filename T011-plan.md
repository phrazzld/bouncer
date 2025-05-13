# T011 Plan: Add unit tests for error handling and exit codes

## Objective
Create comprehensive unit tests for error handling and exit codes in bouncer.js.

## Analysis
The bouncer.js file has multiple error handlers:
- `handleApiKeyError` - For missing/invalid API key issues
- `handleRulesFileError` - For missing/unreadable rules file
- `handleGeminiApiError` - For Gemini API communication errors
- `handleGitCommandError` - For git command failures

Each handler needs dedicated tests to verify:
1. Proper error messages are displayed
2. Appropriate exit codes are set
3. Logging functions work correctly
4. Edge cases are handled

## Test Cases to Implement

### API Key Error Tests (Extend existing tests)
- Test with missing API key
- Test with empty API key
- Test with too-short API key
- Verify exit code, console messages, and log entries

### Rules File Error Tests (Extend existing tests)
- Test with non-existent rules file
- Test with unreadable rules file
- Verify exit code, console messages, and log entries

### Gemini API Error Tests
- Test with network errors
- Test with authentication errors (401/403)
- Test with rate limit errors (429)
- Test with server errors (500+)
- Verify error categorization, exit code, and log entries

### Git Command Error Tests (Extend existing tests)
- Test in non-git repository
- Test with missing git executable
- Test with no staged changes
- Test with repository with no commit history
- Verify exit code, console messages, and log entries

## Implementation Approach
1. Create modular test scripts for each error handler
2. Mock necessary dependencies for isolated testing
3. Use process forking to capture exit codes
4. Verify console output and log entries
5. Implement test helpers for common verification tasks

## Success Criteria
- All error handlers have dedicated tests
- All error cases return appropriate exit codes (non-zero)
- Error messages are clear and user-friendly
- Logging works correctly in all error scenarios
- No unhandled exceptions in error flows