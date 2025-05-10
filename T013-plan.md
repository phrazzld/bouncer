# T013 Plan: First Run Test with Real Commit

## Steps
1. Stage all files with `git add .` to prepare for a commit
2. Attempt to commit with `git commit -m "test"`
3. Verify that the pre-commit hook executes bouncer.js
4. Observe whether the commit is allowed or blocked based on the verdict
5. Confirm the entire end-to-end flow works as expected

## Implementation
The implementation will follow the structure shown in PLAN.md section 5.6:

```bash
# Stage all files
git add .

# Attempt to commit
git commit -m "test: first end-to-end test of bouncer pre-commit hook"
```

### Verification
We'll verify the following aspects of the system:
1. The pre-commit hook is triggered automatically during the commit process
2. The bouncer.js script is executed correctly
3. The Gemini API is called with the diff and rules
4. The verdict is determined (PASS/FAIL)
5. The appropriate action is taken:
   - For PASS: Commit proceeds successfully
   - For FAIL: Commit is blocked with appropriate error message
6. The result is logged to .bouncer.log.jsonl

This test will validate the complete flow of the system from git commit through hook execution, API call, verdict determination, and final outcome. This represents the first true "production" usage of the bouncer system in its intended role as a pre-commit gate.