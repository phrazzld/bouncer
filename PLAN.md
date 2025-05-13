# Plan: Simplified Bouncer Pre-commit Hook Installation via `pre-commit` Framework

## Goal
Create a simplified installation process for Bouncer by integrating it with the `pre-commit` framework, allowing other repositories to easily install and configure Bouncer as a pre-commit hook.

## Architecture Blueprint

### Modules / Packages
- **`bouncer` (This Repository)**:
  - `bouncer.js`: The core Node.js script. Responsibility: Perform diff analysis, communicate with Gemini API, determine commit verdict, log results.
  - `.pre-commit-hooks.yaml`: New file. Responsibility: Define the Bouncer hook for consumption by the `pre-commit` framework, specifying entry point, language, dependencies.
  - `rules.md` (default): The default ruleset provided with Bouncer.
- **Consuming Repository (User's Project)**:
  - `.pre-commit-config.yaml`: User-managed file. Responsibility: Include and configure the Bouncer hook from this repository.
  - `rules.md` (custom or default): User-customizable rules file. Responsibility: Define project-specific commit rules.
  - `.env`: User-managed file. Responsibility: Store the `GEMINI_API_KEY`.
  - `.bouncer.log.jsonl`: Audit log file. Responsibility: Record Bouncer's actions and verdicts. Written by `bouncer.js` to the consuming repo's root.

### Public Interfaces / Contracts
- **`bouncer.js` CLI arguments (enhanced):**
  ```typescript
  // bouncer.js
  // Expected to be run from the root of the consuming repository by pre-commit
  // process.argv will contain paths to files staged for commit

  // Optional arguments for custom paths:
  // --rules-file <path_to_rules_md> (default: ./rules.md)
  // --env-file <path_to_dot_env> (default: ./.env)
  // --log-file <path_to_log_file> (default: ./.bouncer.log.jsonl)
  ```
- **`.pre-commit-hooks.yaml` (in Bouncer repo):**
  ```yaml
  - id: bouncer-check
    name: Bouncer AI Pre-commit Check
    description: Analyzes git diffs using Gemini AI against configurable rules.
    entry: node bouncer.js # Command to execute, pre-commit prepends node if language: node
    language: node
    language_version: '18.0' # Enforces Node.js v18+ for the hook's environment
    # `files` regex is typically not needed as pre-commit passes staged files,
    # but bouncer.js itself calls `git diff --cached`.
    # If we want it to only run if specific files change, we can use `files: \.(js|ts|md)$` etc.
    # For now, assume it runs on every commit and bouncer.js intelligently checks diff.
    # No `files` entry means it runs on all files for every commit.
    pass_filenames: false # Bouncer uses `git diff --cached`, doesn't need individual filenames passed.
    additional_dependencies: ['@google/genai:^0.13.0', 'dotenv:^16.5.0'] # Bouncer's Node.js dependencies
    # `args` can be used by users in their .pre-commit-config.yaml to pass custom paths
  ```
- **User's `.pre-commit-config.yaml` (example in consuming repo):**
  ```yaml
  repos:
  - repo: https://github.com/your-org/bouncer # URL to Bouncer's Git repository
    rev: vX.Y.Z # A specific Git tag/commit for Bouncer version
    hooks:
    - id: bouncer-check
      args:
        - '--rules-file'
        - '.config/bouncer/rules.md'
        - '--env-file'
        - '.config/bouncer/.env'
  ```

### Error & Edge-Case Strategy
- **API Key Missing/Invalid**: `bouncer.js` checks `process.env.GEMINI_API_KEY` after attempting to load `.env`. If missing or invalid, logs error, prints user-friendly message to console, and exits with non-zero code. `pre-commit` reports this as a hook failure.
- **`rules.md` Missing/Unreadable**: `bouncer.js` attempts to read `rules.md`. If file not found or unreadable, logs error, prints message, exits non-zero.
- **Gemini API Errors (Network, Quota, Auth, etc.)**: `bouncer.js` catches errors from `@google/genai`, logs them, prints a user-friendly summary, and exits non-zero.
- **Node.js Version**: Handled by `language_version` in `.pre-commit-hooks.yaml`. `pre-commit` ensures a compatible Node.js version is used.
- **Dependency Issues**: Handled by `pre-commit` which installs `additional_dependencies` in an isolated environment.
- **Non-Git Repository**: `pre-commit install` will fail. `bouncer.js` relies on `git` commands; if run outside a git repo context (though `pre-commit` ensures this), it will fail.

## Implementation Steps

1. **Update `bouncer.js` for CLI Arguments and Path Configurability:**
   1. Integrate a minimal CLI argument parser (e.g., `minimist`, or manual `process.argv` slicing for simplicity if only a few args).
   2. Support `--rules-file <path>`, defaulting to `./rules.md`.
   3. Support `--env-file <path>`, defaulting to `./.env`. Ensure `dotenv` loads from this specified path.
   4. Support `--log-file <path>`, defaulting to `./.bouncer.log.jsonl`.
   5. Ensure all file paths are resolved relative to the current working directory (which `pre-commit` sets to the repository root).

2. **Create `.pre-commit-hooks.yaml` in Bouncer Repository Root:**
   1. Define the hook as specified in the "Public Interfaces / Contracts" section.
   2. Ensure `entry` points to the correct `bouncer.js` path and `language: node` is set.
   3. List `@google/genai` and `dotenv` in `additional_dependencies` with appropriate version constraints (e.g., `^X.Y.Z`).
   4. Set `language_version: '18.0'`.
   5. Set `pass_filenames: false` as Bouncer fetches the diff itself.

3. **Refine `bouncer.js` Error Handling and Output:**
   1. Ensure clear, user-friendly messages are printed to `stdout`/`stderr` for common failures (missing API key, missing rules file, API communication errors).
   2. Maintain structured logging to the configured log file.

4. **Documentation Updates (in Bouncer's `README.md`):**
   1. **Installation Section:**
      - Prerequisite: Install `pre-commit` (link to `pre-commit` official installation guide: `pip install pre-commit`).
      - Instruct users to create/update `.pre-commit-config.yaml` in their repository root with the Bouncer hook definition (provide a copy-pasteable example).
      - Instruct to run `pre-commit install` to activate the hooks.
   2. **Configuration Section:**
      - Explain creation of `.env` file for `GEMINI_API_KEY` and emphasize adding it to `.gitignore`.
      - Explain usage of `rules.md` (default location or custom via `args`).
      - Provide examples for customizing paths using `args` in `.pre-commit-config.yaml`.
   3. **Updating Bouncer Section:**
      - Explain how to update: change the `rev:` in `.pre-commit-config.yaml` to a new Git tag/commit from the Bouncer repository, then run `pre-commit autoupdate` or `pre-commit install --hook-type pre-commit -f`.
   4. **Troubleshooting Section:**
      - Common issues: API key errors, rules file errors, checking `.bouncer.log.jsonl`.

## Testing Strategy

### Unit Tests
- Continue testing core logic of `bouncer.js`.
- Add tests for new CLI argument parsing.
- Mock `fs` operations for reading from configurable paths.
- Mock `@google/genai` to simulate API responses and errors.
- Verify correct exit codes and console output for various scenarios.
- Coverage target: >90% for `bouncer.js`.

### Integration Tests
- Set up a temporary Git repository.
- Install `pre-commit`.
- Create a `.pre-commit-config.yaml` pointing to the local Bouncer checkout.
- Create dummy `.env` and `rules.md`.
- Run `pre-commit install`.
- Test commits:
  - Commit that should pass.
  - Commit that should fail based on rules.
  - Test with missing/invalid API key.
  - Test with missing `rules.md`.
  - Test with custom paths specified in `args`.
- Verify console output, exit codes, and log file content.

## Risk Assessment

| Risk | Severity | Mitigation |
| :--- | :------- | :--------- |
| User forgets/fails to set `GEMINI_API_KEY` correctly | High | `bouncer.js` exits with clear error and guidance. Documentation emphasizes this setup step. |
| User commits `.env` file with API key | Critical | Documentation strongly warns to add `.env` to `.gitignore`. |
| `pre-commit` framework introduces learning curve | Medium | Provide clear documentation for Bouncer setup. Link to official `pre-commit` docs. |
| Node.js dependencies conflict with user project | Low | `pre-commit` creates isolated environments for hooks, preventing dependency conflicts. |
| Changes in Bouncer `bouncer.js` break CLI contract | Medium | Maintain backward compatibility for CLI args. Use semantic versioning for Bouncer tags. |
| `git diff` command fails or behaves unexpectedly | Low | `bouncer.js` should catch errors from `child_process` and report them. |

## Final Deliverables

1. Updated `bouncer.js` with CLI argument support.
2. New `.pre-commit-hooks.yaml` file.
3. Updated documentation in `README.md`.
4. Updated test suite covering new functionality.
5. Git tag for the new version (e.g., `v1.0.0`).