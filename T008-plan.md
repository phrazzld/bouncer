# T008 Plan: Implement Rules Loading and Prompt Construction

## Steps
1. Add code to read the rules from `rules.md` file using fs.readFile
2. Construct the prompt string according to the format specified in PLAN.md
3. Verify the prompt includes all required components:
   - System message with Bouncer introduction
   - Rules from the rules.md file
   - User message with commit hash and diff
   - Instructions for response format (PASS/FAIL with justification)

## Implementation
The implementation will follow the structure shown in PLAN.md section 5.3:

```javascript
// Read rules from rules.md
const rules = await fs.readFile(new URL("./rules.md", import.meta.url), "utf8");

// Construct prompt using the format specified in PLAN.md
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
```

This will combine:
- The previously retrieved git diff
- The previously retrieved commit hash
- The rules loaded from rules.md
- The formatted system and user prompts