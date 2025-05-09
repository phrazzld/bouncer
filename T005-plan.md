# T005 Plan: Populate rules.md with template rules

## Steps
1. Extract the five example rules from PLAN.md
2. Format them as a markdown list in rules.md
3. Verify the rules match the format specified in PLAN.md

## Implementation
The rules should be formatted as a markdown list. According to PLAN.md section 3 (Rule-Set), the examples are:
1. No leaked secrets – grep style tokens, keys, .env
2. Diff size sanity – warn if > 2,000 changed LOC
3. Security foot-guns – eval, exec, SQL string concat
4. Philosophy – must include doc-comment for every exported function
5. Language linters pass (ESLint/Prettier/Clippy etc.)