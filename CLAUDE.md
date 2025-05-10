# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bouncer is a pre-commit AI diff sanity-checker that uses Gemini 2.5 Flash API to evaluate code changes against a set of rules before allowing a commit. It's designed to prevent bad code from entering the codebase by providing a PASS/FAIL gate with rationale.

## Key Commands

```bash
# Install dependencies
npm install

# Run bouncer manually
node ./bouncer.js

# Run a test of bouncer
node ./test-bouncer.js 
```

## Architecture

Bouncer follows a simple architecture:

1. **Script Execution**: Runs as a git pre-commit hook
2. **Diff Analysis**: Extracts the staged diff using `git diff --cached`
3. **Rule Application**: Sends the diff to Gemini API along with predefined rules
4. **Decision**: Based on AI response, either allows commit (PASS) or blocks it (FAIL)
5. **Logging**: Maintains an audit trail in `.bouncer.log.jsonl`

The core functionality is in `bouncer.js`, which:
- Reads rules from `rules.md`
- Gets the staged diff and current commit hash
- Handles large diffs by truncating if necessary
- Sends the prompt to the Gemini API
- Interprets the response and decides to pass or fail
- Logs the verdict and reason

## Configuration

Bouncer requires:
- Node.js 18+ (for fetch API support)
- A Gemini API key in your environment or `.env` file
- Rules defined in `rules.md` (standard rules check for secrets, large diffs, security issues, and documentation)

## Important Files

- `bouncer.js` - Main script that performs the pre-commit check
- `rules.md` - Contains the rules enforced by Bouncer
- `.bouncer.log.jsonl` - Append-only audit trail of commit verdicts
- `.husky/pre-commit` - Git hook that runs Bouncer before each commit

## Development Notes

- When modifying `bouncer.js`, ensure to maintain compatibility with the Gemini API
- The rules in `rules.md` can be customized to match your team's coding standards
- When adding new features, follow the project structure in PLAN.md
- Token limits: Input ≈ 1,048,576 tokens, Output ≈ 65,536 tokens
- Rate limits: 1,000 RPM / 1,000,000 TPM (on Preview tier)