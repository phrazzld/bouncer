# T007 Plan: Implement Git Diff and Commit Hash Retrieval

## Steps
1. Add code to retrieve staged git diff using `execSync("git diff --cached --unified=0")`
2. Add code to retrieve current commit hash using `execSync("git rev-parse --verify HEAD")`
3. Handle the case where there's no commit history (new repository)
4. Verify the code retrieves the information correctly

## Implementation
The implementation will follow the structure shown in PLAN.md section 5.3 (bouncer.js skeleton):
- Use execSync to run git commands with proper encoding
- Capture the output into variables for later use in the prompt
- Handle the edge case of a new repository with no commits (use "<new>" placeholder)