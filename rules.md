# Bouncer Rules

1. No leaked secrets – grep style tokens, keys, .env.
2. Diff size sanity – warn if > 2 000 changed LOC.
3. Security foot-guns – eval, exec, SQL string concat. (NOTE: The use of execSync for Git operations within Bouncer itself is allowed as it operates on controlled inputs.)
4. Philosophy – must include doc-comment for every exported function.
5. Language linters pass (ESLint/Prettier/Clippy etc.).