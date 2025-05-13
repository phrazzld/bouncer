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

There are two ways to install Bouncer: using Husky or using the pre-commit framework.

### Option 1: Installation with Husky

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

> **⚠️ CRITICAL SECURITY WARNING ⚠️**
>
> **YOU MUST ADD `.env` TO YOUR `.gitignore` FILE!**
>
> ```bash
> # Run this command to add .env to .gitignore:
> echo ".env" >> .gitignore
> git add .gitignore
> git commit -m "chore: add .env to gitignore for security"
> ```
>
> Failure to do this could result in:
> - Your API key being exposed publicly
> - Unauthorized usage of your account and billing
> - Potential security breaches
>
> API keys should NEVER be committed to your repository. Always use environment variables or secure key management solutions.

3. Set up the pre-commit hook with Husky:

```bash
# Install Husky
npx husky install

# Add the pre-commit hook
npx husky add .husky/pre-commit "node ./bouncer.js"
git add .husky/pre-commit
```

4. Customize the rules in `rules.md` according to your team's standards.

### Option 2: Installation with pre-commit framework

The [pre-commit](https://pre-commit.com/) framework provides a standardized way to manage Git hooks across multiple languages and tools. This is recommended for teams who use multiple pre-commit hooks or work in polyglot environments.

1. Install the pre-commit framework (if not already installed):

```bash
# Using pip (Python's package manager)
pip install pre-commit

# OR using Homebrew on macOS
brew install pre-commit
```

2. Add Bouncer to your `.pre-commit-config.yaml` file:

```yaml
repos:
- repo: local  # Use 'local' for local hooks
  hooks:
  - id: bouncer-check
    name: Bouncer AI Pre-commit Check
    entry: node /path/to/bouncer.js  # Adjust path to where you installed bouncer.js
    language: node
    language_version: '18.0'
    pass_filenames: false  # Bouncer uses git diff directly
    additional_dependencies: ['@google/genai:^0.13.0', 'dotenv:^16.5.0']
```

3. Create the `.env` file in the root directory and add your Gemini API key:

```bash
GEMINI_API_KEY="your_key_here"
```

> **⚠️ CRITICAL SECURITY WARNING ⚠️**
>
> **YOU MUST ADD `.env` TO YOUR `.gitignore` FILE!**
>
> ```bash
> # Run this command to add .env to .gitignore:
> echo ".env" >> .gitignore
> git add .gitignore
> git commit -m "chore: add .env to gitignore for security"
> ```
>
> Failure to do this could result in:
> - Your API key being exposed publicly
> - Unauthorized usage of your account and billing
> - Potential security breaches
>
> API keys should NEVER be committed to your repository. Always use environment variables or secure key management solutions.

4. Install the pre-commit hook:

```bash
pre-commit install
```

5. Customize the rules in `rules.md` according to your team's standards.

### Getting a Gemini API Key

To get a Gemini API key:

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create or sign in to your Google account
3. Click "Create API Key"
4. Copy the generated key to your `.env` file

Note: API keys are subject to usage quotas and rate limits.

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
| `429 TOO_MANY_REQUESTS` | Rate limit or quota exceeded | Wait a few minutes and try again or check your API usage limits |
| `120s timeout` | Very large diff or runtime limit | Diff is likely too large; commit smaller changes |
| Missing API key error | API key not set in .env | Ensure `.env` file exists with `GEMINI_API_KEY="your_key_here"` |
| Network error | No internet connection | Check your internet connection and try again |
| `Error: Not a git repository` | Not running from within a git repo | Make sure to run Bouncer from within a git repository |
| `No staged changes found` | No files added to staging area | Use `git add` to stage files before running Bouncer |
| `Could not read rules file` | Rules file missing or unreadable | Ensure the rules file exists at the expected path |
| Hook not running | Pre-commit hook not installed correctly | Run `pre-commit install` or check Husky setup |

### Error Handling

Bouncer includes comprehensive error handling:

- Validates the API key exists before making requests
- Gracefully handles API outages and connection issues
- Provides clear error messages with next steps
- Logs errors to the audit trail for tracking

### Updating Bouncer

If you installed Bouncer with the pre-commit framework, update your `.pre-commit-config.yaml` file to point to the latest version:

```yaml
repos:
- repo: https://github.com/your-org/bouncer
  rev: v1.0.0  # Update this to the latest version
  hooks:
  - id: bouncer-check
```

Then run `pre-commit autoupdate` to update all hooks to their latest versions.

If you installed Bouncer directly, simply update the files in your repository with the latest version from the source.

## Advanced Configuration

### Custom CLI Arguments

Bouncer supports several command-line arguments for customization:

| Argument | Description | Default |
|----------|-------------|---------|
| `--rules-file` | Path to the rules file | `./rules.md` |
| `--env-file` | Path to the environment file containing the API key | `./.env` |
| `--log-file` | Path to the log file | `./.bouncer.log.jsonl` |
| `--debug` | Enable debug mode | disabled |

#### Using Custom Paths with Husky

```bash
npx husky add .husky/pre-commit "node ./bouncer.js --rules-file ./custom-rules.md --env-file ./secrets/.env.gemini"
```

#### Using Custom Paths with pre-commit

```yaml
repos:
- repo: local
  hooks:
  - id: bouncer-check
    name: Bouncer AI Pre-commit Check
    entry: node /path/to/bouncer.js --rules-file ./custom-rules.md --env-file ./secrets/.env.gemini
    language: node
    pass_filenames: false
    additional_dependencies: ['@google/genai:^0.13.0', 'dotenv:^16.5.0']
```

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

### Custom Rules

The rules.md file can be customized to match your team's specific requirements:

```markdown
# Bouncer Rules

1. No secrets or credentials in code (API keys, tokens, passwords)
2. No database connection strings with credentials
3. Maximum diff size of 1000 lines
4. All exported functions must have JSDoc comments
5. No direct console.log statements in production code
6. No TODO comments without associated ticket numbers
7. Follow team's coding style guidelines (indentation, naming conventions)
8. No security vulnerabilities (SQL injection, XSS)
```

Bouncer sends these rules directly to the Gemini AI model, which evaluates your diff against them.

## Future Roadmap

Planned enhancements include:

1. Configurable rule registry (YAML) & per-repo overrides
2. Shared key vault integration for API key
3. Remote log collector for centralized analytics
4. PR-level mode for GitHub Actions
5. Structured JSON verdicts using function-calling

## License

ISC