# Bouncer

> "Prevent bad code from entering the club."

Bouncer is a lightweight pre-commit hook that uses Gemini 2.5 Flash AI to analyze your code changes and ensure they meet your team's standards before allowing a commit.

## Features

- **AI-Powered Code Review:** Uses Gemini 2.5 Flash to analyze git diffs against your rules
- **Fast Feedback:** < 1 second typical response time for small to medium diffs
- **Customizable Rules:** Define your own rules in simple Markdown format
- **Local Operation:** No server needed, operates entirely within your local repository
- **Audit Trail:** Maintains a log of all commit checks with verdicts and timestamps
- **Cost Effective:** < ¼¢ per short diff with Gemini 2.5 Flash

## Requirements

- Node.js 18 or higher (required for native fetch API)
- Git repository with ability to install pre-commit hooks
- Gemini API key (see setup instructions)

## Installation

1. Clone or copy Bouncer into your project:

```bash
# Create the directory structure
mkdir -p .git/hooks

# Install dependencies
npm init -y
npm install @google/genai dotenv husky
```

2. Create the `.env` file in the root directory and add your Gemini API key:

```bash
GEMINI_API_KEY="your_key_here"
```

> **Important:** Make sure to add `.env` to your `.gitignore` to prevent accidentally exposing your API key.

3. Set up the pre-commit hook with Husky:

```bash
# Install Husky
npx husky install

# Add the pre-commit hook
npx husky add .husky/pre-commit "node ./bouncer.js"
git add .husky/pre-commit
```

4. Customize the rules in `rules.md` according to your team's standards.

## Usage

### As a Pre-commit Hook

Once installed, Bouncer automatically runs on every commit:

```bash
git add .
git commit -m "Your commit message"
```

Bouncer will evaluate your changes against the rules in `rules.md`:

- If all rules pass: The commit proceeds normally
- If any rule fails: The commit is blocked, and Bouncer explains why

Example output on failure:
```
🛑 Bouncer blocked this commit:
FAIL – Found potential API key in the diff in file config.js. Secret values should not be committed.
```

### Manual Usage

You can also run Bouncer manually to check changes before committing:

```bash
./bouncer.js
```

### Customizing Rules

Edit `rules.md` to define your team's rules. Format is a Markdown list. Example:

```markdown
# Bouncer Rules

1. No leaked secrets – grep style tokens, keys, .env.
2. Diff size sanity – warn if > 2 000 changed LOC.
3. Security foot-guns – eval, exec, SQL string concat.
4. Philosophy – must include doc-comment for every exported function.
5. Language linters pass (ESLint/Prettier/Clippy etc.).
```

Bouncer includes these rules in the prompt to Gemini, which evaluates your diff against them.

## Audit Log

Bouncer maintains a log of all checks in `.bouncer.log.jsonl`. Each entry includes:

- Timestamp
- Commit hash
- Verdict (PASS/FAIL)
- Reason (explanation from the AI)
- Token usage statistics

Example log entry:
```json
{
  "ts": "2025-05-10T08:27:03.455Z",
  "commit": "b917a35",
  "verdict": "PASS",
  "reason": "PASS – The diff is a simple change to a markdown file...",
  "usage": {
    "inputTokens": 4625,
    "outputTokens": 39,
    "totalTokens": 5330,
    "diffTokens": 4421,
    "truncated": false
  }
}
```

## Troubleshooting

### Common Issues

| Problem | Likely Cause | Solution |
|---------|--------------|----------|
| `TypeError: fetch failed` | Proxy issue or old Node.js | Ensure Node.js 18+ is installed and that global.fetch exists |
| `401 INVALID_ARGUMENT` | Invalid or expired API key | Regenerate your API key in Google AI Studio → API keys |
| `120s timeout` | Very large diff or runtime limit | Diff is likely too large; commit smaller changes |
| Missing API key error | API key not set in .env | Ensure `.env` file exists with `GEMINI_API_KEY="your_key_here"` |
| Network error | No internet connection | Check your internet connection and try again |

### Error Handling

Bouncer includes comprehensive error handling:

- Validates the API key exists before making requests
- Gracefully handles API outages and connection issues
- Provides clear error messages with next steps
- Logs errors to the audit trail for tracking

## Advanced Configuration

### Handling Large Diffs

For large repositories or extensive changes, Bouncer automatically:

1. Precisely counts tokens using Gemini's countTokens API
2. Truncates diffs that exceed the token limit (800,000 tokens)
3. Includes metadata about truncation in logs and output

### Token Usage and Quota Tracking

Bouncer tracks token usage for each commit check:
- Input tokens (prompt size)
- Output tokens (AI response size)
- Whether truncation was needed

This information is displayed in the console output and saved in the log file.

## Future Roadmap

Planned enhancements include:

1. Configurable rule registry (YAML) & per-repo overrides
2. Shared key vault integration for API key
3. Remote log collector for centralized analytics
4. PR-level mode for GitHub Actions
5. Structured JSON verdicts using function-calling

## License

ISC