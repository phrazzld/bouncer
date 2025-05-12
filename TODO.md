# Todo

## `bouncer.js` CLI Arguments & Configuration
- [x] **T001 · Feature · P1: implement cli argument parsing foundation**
    - **Context:** Implementation Steps 1.1
    - **Action:**
        1. Integrate a minimal CLI argument parser (e.g., `minimist`) into `bouncer.js` to process `process.argv`.
    - **Done‑when:**
        1. `bouncer.js` can parse command-line arguments into an accessible object.
        2. Foundation for specific argument handling (e.g., `--rules-file`) is established.
    - **Depends‑on:** none

- [x] **T002 · Feature · P1: add `--rules-file` cli argument support**
    - **Context:** Implementation Steps 1.2, 1.5
    - **Action:**
        1. Modify `bouncer.js` to accept a `--rules-file <path>` CLI argument.
        2. Implement a default value of `./rules.md` if the argument is not provided.
        3. Ensure the specified or default path is resolved relative to the current working directory.
    - **Done‑when:**
        1. `bouncer.js` reads the rules from the path specified by `--rules-file` or the default.
        2. Path resolution relative to CWD is confirmed.
    - **Verification:**
        1. Run `bouncer.js` with a custom `--rules-file` path and verify it attempts to read that file.
        2. Run `bouncer.js` without `--rules-file` and verify it attempts to read `./rules.md`.
    - **Depends‑on:** [T001]

- [x] **T003 · Feature · P1: add `--env-file` cli argument support**
    - **Context:** Implementation Steps 1.3, 1.5
    - **Action:**
        1. Modify `bouncer.js` to accept an `--env-file <path>` CLI argument.
        2. Implement a default value of `./.env` if the argument is not provided.
        3. Ensure `dotenv` loads environment variables from the specified or default path, resolved relative to CWD.
    - **Done‑when:**
        1. `bouncer.js` loads environment variables from the path specified by `--env-file` or the default.
        2. Path resolution relative to CWD is confirmed for the `.env` file.
    - **Verification:**
        1. Create a custom `.env` file at a non-default path, run `bouncer.js` with `--env-file` pointing to it, and verify `GEMINI_API_KEY` is loaded.
    - **Depends‑on:** [T001]

- [x] **T004 · Feature · P1: implement `--log-file` argument and ensure structured audit logging**
    - **Context:** Implementation Steps 1.4, 1.5; Architecture Blueprint (`.bouncer.log.jsonl`)
    - **Action:**
        1. Modify `bouncer.js` to accept a `--log-file <path>` CLI argument, defaulting to `./.bouncer.log.jsonl`.
        2. Ensure the specified or default path is resolved relative to CWD.
        3. Ensure `bouncer.js` writes all audit logs (actions, verdicts, errors) in a structured JSONL format to this path.
    - **Done‑when:**
        1. `bouncer.js` writes logs to the path specified by `--log-file` or the default.
        2. All Bouncer actions, verdicts (pass/fail), and errors are logged in structured JSONL format.
    - **Verification:**
        1. Run `bouncer.js` (simulating a commit) and verify the log file is created at the correct path with structured JSONL entries.
        2. Test with a custom `--log-file` path.
    - **Depends‑on:** [T001]

## `bouncer.js` Error Handling
- [x] **T005 · Feature · P1: implement error handling for missing/invalid `GEMINI_API_KEY`**
    - **Context:** Error & Edge-Case Strategy; Implementation Steps 3
    - **Action:**
        1. In `bouncer.js`, after attempting to load the `.env` file, check if `process.env.GEMINI_API_KEY` is missing or invalid (e.g., empty).
        2. If so, print a clear, user-friendly error message to the console and exit with a non-zero status code.
        3. Log the error to the configured log file.
    - **Done‑when:**
        1. `bouncer.js` exits with a non-zero code and user-friendly message if API key is missing/invalid.
        2. Error is logged to the specified log file.
    - **Verification:**
        1. Run `bouncer.js` without `GEMINI_API_KEY` set (or set to empty) and verify console output, exit code, and log entry.
    - **Depends‑on:** [T001, T003, T004]

- [ ] **T006 · Feature · P1: implement error handling for missing/unreadable `rules.md` file**
    - **Context:** Error & Edge-Case Strategy; Implementation Steps 3
    - **Action:**
        1. In `bouncer.js`, when attempting to read the `rules.md` file, handle file not found or unreadable errors.
        2. If an error occurs, print a clear, user-friendly error message to the console and exit with a non-zero status code.
        3. Log the error to the configured log file.
    - **Done‑when:**
        1. `bouncer.js` exits with a non-zero code and user-friendly message if the rules file is missing or unreadable.
        2. Error is logged to the specified log file.
    - **Verification:**
        1. Run `bouncer.js` with the `--rules-file` pointing to a non-existent or unreadable file and verify console output, exit code, and log entry.
    - **Depends‑on:** [T001, T002, T004]

- [ ] **T007 · Feature · P1: implement error handling for gemini api communication errors**
    - **Context:** Error & Edge-Case Strategy; Implementation Steps 3
    - **Action:**
        1. In `bouncer.js`, wrap calls to the `@google/genai` API in try-catch blocks to handle network issues, authentication failures, quota limits, etc.
        2. If an API error occurs, print a user-friendly summary to the console and exit with a non-zero status code.
        3. Log the detailed error from `@google/genai` to the configured log file.
    - **Done‑when:**
        1. `bouncer.js` exits with a non-zero code and user-friendly summary if Gemini API calls fail.
        2. Detailed API error is logged to the specified log file.
    - **Verification:**
        1. Mock the `@google/genai` client to throw various errors and verify console output, exit code, and log entries.
    - **Depends‑on:** [T001, T004]

- [ ] **T008 · Feature · P2: implement error handling for `git diff --cached` command failures**
    - **Context:** Risk Assessment (`git diff` command fails or behaves unexpectedly); Implementation Steps 3
    - **Action:**
        1. In `bouncer.js`, when executing `git diff --cached`, catch any errors from the child process execution.
        2. If an error occurs, print a clear error message to the console (e.g., "Not a git repository or no staged files") and exit with a non-zero status code.
        3. Log the error to the configured log file.
    - **Done‑when:**
        1. `bouncer.js` exits with a non-zero code and user-friendly message if `git diff --cached` fails.
        2. Error is logged to the specified log file.
    - **Verification:**
        1. Attempt to run `bouncer.js` in a directory that is not a Git repository, or with no staged files, and verify console output, exit code, and log entry.
    - **Depends‑on:** [T001, T004]

## `pre-commit` Framework Integration
- [ ] **T009 · Feature · P1: create and configure `.pre-commit-hooks.yaml` file**
    - **Context:** Implementation Steps 2; Public Interfaces / Contracts
    - **Action:**
        1. Create a new file named `.pre-commit-hooks.yaml` in the root of the Bouncer repository.
        2. Define the `bouncer-check` hook as specified in the "Public Interfaces / Contracts" section of the plan, including `id`, `name`, `description`, `entry`, `language`, `language_version`, `additional_dependencies`, and `pass_filenames: false`.
    - **Done‑when:**
        1. `.pre-commit-hooks.yaml` file exists and is correctly formatted.
        2. The hook definition matches the plan specifications.
    - **Verification:**
        1. In a test consuming repository, add the Bouncer hook using the local path to `.pre-commit-hooks.yaml` and run `pre-commit install`.
        2. Trigger the hook and verify `bouncer.js` is executed.
    - **Depends‑on:** none

## Testing
- [ ] **T010 · Test · P1: add unit tests for CLI argument parsing and path handling**
    - **Context:** Testing Strategy: Unit Tests, Implementation Steps 1
    - **Action:**
        1. Add tests to cover all argument combinations and default handling.
        2. Mock filesystem and environment loading for path tests.
    - **Done‑when:**
        1. All argument permutations and path logic are tested.
        2. >90% coverage on CLI parsing code.
    - **Verification:**
        1. Run test suite, confirm coverage and all tests pass.
    - **Depends‑on:** [T001, T002, T003, T004]

- [ ] **T011 · Test · P1: add unit tests for error handling and exit codes**
    - **Context:** Testing Strategy: Unit Tests, Implementation Steps 3
    - **Action:**
        1. Add tests that simulate missing/invalid API key, missing/unreadable rules file, Gemini API errors.
        2. Assert proper error messages, log output, and exit codes.
    - **Done‑when:**
        1. All key error cases are tested and verified.
        2. No unhandled exceptions in error flows.
    - **Verification:**
        1. Run test suite and simulate failures; verify output and logs.
    - **Depends‑on:** [T005, T006, T007, T008]

- [ ] **T012 · Test · P0: implement integration tests for pre-commit hook in a temp git repo**
    - **Context:** Testing Strategy: Integration Tests
    - **Action:**
        1. Set up temp repo, install pre-commit, configure Bouncer hook.
        2. Test commits with passing/failing diffs, missing API key, missing rules, and custom path args.
        3. Verify hook runs, outputs, exit codes, and log file.
    - **Done‑when:**
        1. All scenarios pass/fail as expected.
        2. Integration test suite can run in CI.
    - **Verification:**
        1. Run tests and manually inspect output/logs if needed.
    - **Depends‑on:** [T001, T002, T003, T004, T005, T006, T007, T008, T009]

## Documentation (`README.md`)
- [ ] **T013 · Feature · P0: update README.md with pre-commit installation and configuration instructions**
    - **Context:** Implementation Steps 4.1-4.2
    - **Action:**
        1. Add installation steps for `pre-commit` and Bouncer hook configuration.
        2. Document `.pre-commit-config.yaml` example, running `pre-commit install`, and optional custom args.
        3. Explain creation of `.env` file for `GEMINI_API_KEY` and usage of `rules.md`.
        4. Provide examples for customizing paths using `args` in `.pre-commit-config.yaml`.
    - **Done‑when:**
        1. README.md contains clear, accurate installation and configuration instructions.
    - **Verification:**
        1. Follow instructions from scratch and confirm successful install in a test repo.
    - **Depends‑on:** [T009]

- [ ] **T014 · Chore · P0: add explicit warning to add `.env` file to `.gitignore`**
    - **Context:** Risk Assessment (User commits `.env` file with API key)
    - **Action:**
        1. Add a prominent and critical warning in the "Configuration" section of `README.md` instructing users to add their `.env` file (or custom-named env file) to their project's `.gitignore`.
    - **Done‑when:**
        1. A clear, hard-to-miss warning about adding the `.env` file to `.gitignore` is present in `README.md`.
    - **Verification:**
        1. Review README.md for placement and clarity.
    - **Depends‑on:** [T013]

- [ ] **T015 · Chore · P1: add updating and troubleshooting sections to README.md**
    - **Context:** Implementation Steps 4.3-4.4
    - **Action:**
        1. Add update/upgrade instructions for Bouncer versioning, explaining how to change the `rev:` value in `.pre-commit-config.yaml`.
        2. Create a "Troubleshooting" section with common issues and solutions: API key errors, rules file errors, etc.
    - **Done‑when:**
        1. Both sections are present, accurate, and cover intended topics.
    - **Verification:**
        1. Review and confirm completeness of documentation.
    - **Depends‑on:** [T013]

## Version Tagging and Release
- [ ] **T016 · Chore · P1: create git tag for new release upon completion**
    - **Context:** Final Deliverables
    - **Action:**
        1. Tag release commit with semantic version (e.g., v1.0.0) after all work is merged.
    - **Done‑when:**
        1. Tag appears in repository.
    - **Verification:**
        1. Check tag on GitHub/Git and confirm users can reference it in `.pre-commit-config.yaml`.
    - **Depends‑on:** [T001, T002, T003, T004, T005, T006, T007, T008, T009, T010, T011, T012, T013, T014, T015]