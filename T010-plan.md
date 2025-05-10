# T010 Plan: Implement Logging and Verdict Handling

## Steps
1. Add code to log verdict and rationale to `.bouncer.log.jsonl` in the specified JSON format
2. Implement conditional exit based on verdict (exit 1 for FAIL, exit 0 for PASS)
3. Add appropriate console output to inform the user of the verdict with clear visuals
4. Verify the implementation works correctly in different scenarios

## Implementation
The implementation will follow the structure shown in PLAN.md section 5.3 and section 6 for logging format:

```javascript
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

// Display appropriate console output based on verdict
if (verdict === "FAIL") {
  console.error("\n🛑 Bouncer blocked this commit:\n" + res.text);
  process.exit(1);
} else {
  console.log("✅ Bouncer PASS");
}
```

### Logging Logic
- Use fs.appendFile to add a new line to .bouncer.log.jsonl
- Format the log entry as a JSON object with the required fields:
  - ts: timestamp in ISO 8601 format (e.g., "2025-05-08T10:15:42Z")
  - commit: the git commit hash
  - verdict: "PASS" or "FAIL"
  - reason: the full response text from the API

### Verdict Handling
- For FAIL verdict:
  - Display a clear error message with the 🛑 emoji
  - Include the full rationale from the API
  - Exit with code 1 to signal failure to Git
- For PASS verdict:
  - Display a simple success message with the ✅ emoji
  - Exit with code 0 (implicitly when the script ends normally)

### Testing Strategy
- Verify log file is created and formatted correctly
- Verify console output is clear and helpful
- Test both PASS and FAIL scenarios to ensure correct exit behavior