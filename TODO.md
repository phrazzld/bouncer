# Bouncer – Task Breakdown

## Project Bootstrap
- [x] **T001 · Chore · P0: initialize project with pnpm**
    - **Context:** PLAN.md §5.1 Bootstrap
    - **Action:**
        1. Run `pnpm init` in the current directory.
    - **Done‑when:**
        1. A valid `package.json` exists in the project root.
    - **Verification:**
        1. `ls` command shows `package.json` in the root directory.
    - **Depends‑on:** none

- [x] **T002 · Chore · P0: install core dependencies**
    - **Context:** PLAN.md §5.1 Bootstrap
    - **Action:**
        1. Run `pnpm add @google/genai dotenv`.
    - **Done‑when:**
        1. `@google/genai` and `dotenv` are listed as dependencies in `package.json`.
        2. `node_modules` directory contains these packages.
    - **Verification:**
        1. `pnpm list @google/genai dotenv` shows both installed.
    - **Depends‑on:** [T001]

- [x] **T003 · Chore · P0: create placeholder files**
    - **Context:** PLAN.md §4 Directory Layout
    - **Action:**
        1. Create files: `bouncer.js`, `rules.md`, `.bouncer.log.jsonl`, `.env`.
    - **Done‑when:**
        1. All required files exist in the project root.
    - **Verification:**
        1. `ls -la` shows all specified files.
    - **Depends‑on:** [T001]

## Environment Configuration
- [x] **T004 · Chore · P0: configure `.env` for API key and add to `.gitignore`**
    - **Context:** PLAN.md §2 Auth, §4 Directory Layout
    - **Action:**
        1. Add the line `GEMINI_API_KEY=""` to `.env`.
        2. Ensure `.gitignore` includes the line `.env` to prevent tracking.
    - **Done‑when:**
        1. `.env` contains the `GEMINI_API_KEY` placeholder.
        2. `.gitignore` exists and lists `.env` to prevent tracking.
    - **Verification:**
        1. `cat .env` shows the placeholder.
        2. `git status` (after staging `.gitignore`) shows `.env` as untracked or ignored.
    - **Depends‑on:** [T003]

## Rule Definition
- [x] **T005 · Feature · P0: populate `rules.md` with template rules**
    - **Context:** PLAN.md §3 Rule-Set, §5.2 Write rules.md
    - **Action:**
        1. Edit `rules.md` to include the five example rules listed in PLAN.md.
    - **Done‑when:**
        1. `rules.md` contains the specified template rules.
    - **Verification:**
        1. View `rules.md`; content matches PLAN.md example.
    - **Depends‑on:** [T003]

## Main Script (`bouncer.js`) - Core Logic
- [x] **T006 · Feature · P0: implement script boilerplate and AI client initialization**
    - **Context:** PLAN.md §5.3 bouncer.js skeleton
    - **Action:**
        1. Add `#!/usr/bin/env node` shebang to the top of `bouncer.js`.
        2. Add required import statements (`fs`, `child_process`, `@google/genai`, `dotenv/config`).
        3. Initialize the `GoogleGenAI` client using `process.env.GEMINI_API_KEY`.
    - **Done‑when:**
        1. `bouncer.js` has the shebang and necessary imports.
        2. `GoogleGenAI` client is initialized, ready to use the API key from `.env`.
    - **Verification:**
        1. Basic script structure is in place.
    - **Depends‑on:** [T002, T003, T004]

- [x] **T007 · Feature · P0: implement git diff and commit hash retrieval**
    - **Context:** PLAN.md §5.3 bouncer.js skeleton
    - **Action:**
        1. Add code to execute `git diff --cached --unified=0` and capture the output.
        2. Add code to execute `git rev-parse --verify HEAD` and capture the commit hash.
        3. Handle the case of a new repository with no commits (use placeholder like "<new>").
    - **Done‑when:**
        1. Git diff and commit hash retrieval code is implemented.
    - **Verification:**
        1. Code correctly retrieves diff and commit hash in a git repository.
    - **Depends‑on:** [T006]

- [x] **T008 · Feature · P0: implement rules loading and prompt construction**
    - **Context:** PLAN.md §5.3 bouncer.js skeleton, §3 Rule-Set
    - **Action:**
        1. Add code to read the rules from `rules.md`.
        2. Construct the prompt string per PLAN.md format, incorporating rules, commit hash, and diff.
    - **Done‑when:**
        1. Code that reads rules and constructs the prompt is implemented.
    - **Verification:**
        1. Generated prompt follows the format specified in PLAN.md.
    - **Depends‑on:** [T005, T007]

- [ ] **T009 · Feature · P0: implement Gemini API call and response handling**
    - **Context:** PLAN.md §5.3 bouncer.js skeleton, §2 Gemini API
    - **Action:**
        1. Call the Gemini API with the constructed prompt.
        2. Parse the response text to determine PASS/FAIL verdict.
    - **Done‑when:**
        1. Code that calls the API and determines the verdict is implemented.
    - **Verification:**
        1. API call correctly returns a response with a PASS or FAIL determination.
    - **Depends‑on:** [T008]

- [ ] **T010 · Feature · P0: implement logging and verdict handling**
    - **Context:** PLAN.md §5.3 bouncer.js skeleton, §6 Logging Format
    - **Action:**
        1. Add code to log verdict and rationale to `.bouncer.log.jsonl` in the specified format.
        2. Implement conditional exit based on verdict (exit 1 for FAIL, exit 0 for PASS).
        3. Add appropriate console output to inform the user of the verdict.
    - **Done‑when:**
        1. Log entry is written to `.bouncer.log.jsonl` with all required fields.
        2. Script exits with proper code and user feedback on console.
    - **Verification:**
        1. Log file contains entries in correct JSON format.
        2. Console output is informative and script exits with appropriate code.
    - **Depends‑on:** [T009]

- [ ] **T011 · Chore · P0: make bouncer.js executable**
    - **Context:** PLAN.md §5.4 Make executable
    - **Action:**
        1. Run `chmod +x bouncer.js` to make the script executable.
    - **Done‑when:**
        1. File has execute permissions.
    - **Verification:**
        1. Can run `./bouncer.js` from the command line.
    - **Depends‑on:** [T010]

## Git Hook Integration
- [ ] **T012 · Feature · P0: install and configure Husky pre-commit hook**
    - **Context:** PLAN.md §5.5 Install pre-commit hook
    - **Action:**
        1. Run `npx husky install` to set up Husky.
        2. Add `.husky/pre-commit` hook to execute `node ./bouncer.js`.
        3. Add and commit the hook to version control.
    - **Done‑when:**
        1. Husky is installed, `.husky/pre-commit` runs `bouncer.js` on every commit.
    - **Verification:**
        1. Pre-commit hook is triggered when attempting to commit.
    - **Depends‑on:** [T011]

- [ ] **T013 · Test · P1: first run test with real commit**
    - **Context:** PLAN.md §5.6 First run
    - **Action:**
        1. Stage all files with `git add .`.
        2. Attempt to commit with `git commit -m "test"`.
    - **Done‑when:**
        1. Pre-commit hook executes `bouncer.js`.
        2. Commit is either allowed or blocked based on the verdict.
    - **Verification:**
        1. Complete end-to-end flow works as expected.
    - **Depends‑on:** [T012]

## Edge Cases & Hardening
- [ ] **T014 · Feature · P1: handle large diffs by truncating input**
    - **Context:** PLAN.md §7 Edge-Cases & Hardening
    - **Action:**
        1. Add logic to detect large diffs (> 100k tokens).
        2. Implement truncation with context markers or chunking for large diffs.
    - **Done‑when:**
        1. Script handles large diffs without exceeding token limits.
    - **Verification:**
        1. Test with a very large diff and confirm truncation/handling.
    - **Depends‑on:** [T010]

- [ ] **T015 · Feature · P1: handle API outage or missing key gracefully**
    - **Context:** PLAN.md §7 Edge-Cases & Hardening
    - **Action:**
        1. Add error handling around API calls.
        2. Detect missing API key and provide user-friendly error message.
        3. Implement configurable behavior for API failures (hard-fail or warn).
    - **Done‑when:**
        1. Script handles API errors gracefully with helpful messages.
    - **Verification:**
        1. Test with invalid/missing API key and check error handling.
    - **Depends‑on:** [T010]

- [ ] **T016 · Feature · P2: implement token counting and quota tracking**
    - **Context:** PLAN.md §7 Edge-Cases & Hardening
    - **Action:**
        1. Add logic to count tokens locally via the appropriate endpoint.
        2. Track and log API quota usage using response headers.
    - **Done‑when:**
        1. Script logs token usage statistics.
    - **Verification:**
        1. Log file or console output includes token usage information.
    - **Depends‑on:** [T010]

## Documentation
- [ ] **T017 · Chore · P1: create README.md with setup and usage instructions**
    - **Context:** PLAN.md §Documentation Approach
    - **Action:**
        1. Create `README.md` with project description, setup steps, usage examples.
        2. Include troubleshooting section based on PLAN.md §9.
    - **Done‑when:**
        1. README.md exists with comprehensive documentation.
    - **Verification:**
        1. Review content for completeness and accuracy.
    - **Depends‑on:** [T013]

## Open Questions & Clarifications
- [ ] **Issue:** Should API failures (no key, outage) result in blocked commits (hard-fail) or warnings with allowed commits?
    - **Context:** PLAN.md §7 Edge-Cases & Hardening
    - **Blocking?:** Yes, decision needed for T015
    
- [ ] **Issue:** Is token/quota tracking required for MVP or can it be deferred?
    - **Context:** PLAN.md §7 Edge-Cases & Hardening
    - **Blocking?:** No, implemented as P2 in T016

## Future Roadmap (Post-MVP)
- [ ] **T018 · Feature · P3: implement configurable rule registry (YAML) with per-repo overrides**
    - **Context:** PLAN.md §8 Roadmap After MVP
    - **Depends‑on:** [T013]

- [ ] **T019 · Feature · P3: add shared key vault integration for API key**
    - **Context:** PLAN.md §8 Roadmap After MVP
    - **Depends‑on:** [T013]

- [ ] **T020 · Feature · P3: implement remote log collector for centralized analytics**
    - **Context:** PLAN.md §8 Roadmap After MVP
    - **Depends‑on:** [T013]

- [ ] **T021 · Feature · P3: add PR-level mode for GitHub Actions**
    - **Context:** PLAN.md §8 Roadmap After MVP
    - **Depends‑on:** [T013]

- [ ] **T022 · Feature · P3: use function-calling for structured JSON verdicts**
    - **Context:** PLAN.md §8 Roadmap After MVP
    - **Depends‑on:** [T013]