# T012 Plan: Install and Configure Husky Pre-commit Hook

## Steps
1. Install Husky using `npx husky install`
2. Create a pre-commit hook to execute bouncer.js
3. Add the hook to version control
4. Verify the hook works correctly

## Implementation
The implementation will follow the structure shown in PLAN.md section 5.5:

```bash
# Install Husky
npx husky install

# Add pre-commit hook to execute bouncer.js
npx husky add .husky/pre-commit "node ./bouncer.js"

# Add the hook to version control
git add .husky/pre-commit
```

### Husky Setup
Husky is a Git hooks tool that allows us to run scripts before committing, pushing, etc. We'll use it to run our bouncer.js script before each commit to ensure our commits adhere to the rules specified in rules.md.

### Pre-commit Hook Configuration
The pre-commit hook will be configured to execute our bouncer.js script. This script will:
1. Get the staged diff
2. Get the commit hash
3. Read the rules
4. Construct the prompt and call the Gemini API
5. Determine if the commit passes or fails based on the rules
6. Exit with code 1 if it fails, which will abort the commit

### Verification
We'll verify the hook works by:
1. Making a change to a file
2. Staging the change
3. Attempting to commit
4. Confirming the hook executes bouncer.js

Since we've already implemented the bouncer.js script to log to .bouncer.log.jsonl, we'll also be able to see the results of the hook execution in the log file.