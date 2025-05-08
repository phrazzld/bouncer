# Bouncer – Pre-commit AI Diff Sanity-Checker
**Target model:** `gemini-2.5-flash-preview-04-17`
**Language/Runtime:** Node 18+ / TypeScript optional
**Status:** v0-draft-MVP

---

## 0. Why Bouncer?

> “Prevent bad code from entering the club.”

* Automate a PASS/FAIL gate against a hard-coded philosophy/rule set *before* every commit.
* Persist a local audit trail—commit hash, verdict, rationale, timestamp.
* Fast feedback (< 1 s typical with 2.5 Flash) and cheap (< ¼ ¢ per short diff).

---

## 1. Quick Design-Space Survey

| # | Architecture | Secrets Exposure | Setup Time | Pros | Cons |
|---|--------------|------------------|------------|------|------|
| **A** | *Inline script* in the repo + Git hook (no server) | API key lives in `.env` | **Minutes** | Simplest, no infra | Devs must all add key; logs local only |
| **B** | Same script, but key pulled from OS keychain / 1Password CLI | None on disk | 1-2 h | Safer secrets | Extra dependency |
| **C** | Local daemon service. Hook UNIX-socket RPC. | Env-file in daemon dir | 2-4 h | Re-uses model context across runs, can cache rules in memory | More moving parts |
| **D** | Remote micro-service; hook does `curl` | Central key mgmt; logs aggregated | 1-2 days | Centralized analytics & tuning | Needs auth, CI ingress, network latency |

**Recommendation:** Start with **A** (get it working today), refactor toward **C** once useful.

---

## 2. Gemini 2.5 Flash API Cheat-Sheet

* **Install SDK**

  ```bash
  npm i @google/genai

Requires Node 18+ (fetch & async iterators) ￼
	•	Auth

export GEMINI_API_KEY="<redacted>"

or place in .env; code picks up from process.env.GEMINI_API_KEY.

	•	Single-shot request

import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash-preview-04-17",
  contents: promptString,
  // optional fine-tuning
  config: { temperature: 0.1, candidateCount: 1 }
});
console.log(response.text);
``` [oai_citation:1‡Google AI for Developers](https://ai.google.dev/gemini-api/docs/quickstart?lang=node)


	•	Streaming (future) – generateContentStream() returns an async iterator ￼
	•	Token & rate limits (Preview tier)
Input ≈ 1 048 576   Output ≈ 65 536 tokens ￼
1 000 RPM / 1 000 000 TPM default ￼

⸻

3. Rule-Set (hard-coded for v0)

Edit rules.md (markdown list).  Examples:
	1.	No leaked secrets – grep style tokens, keys, .env.
	2.	Diff size sanity – warn if > 2 000 changed LOC.
	3.	Security foot-guns – eval, exec, SQL string concat.
	4.	Philosophy – must include doc-comment for every exported function.
	5.	Language linters pass (ESLint/Prettier/Clippy etc.).

The prompt template concatenates:

SYSTEM:
You are *Bouncer*, an uncompromising reviewer.
Enforce the following rules:
<rules.md contents>

USER:
Commit <hash> diff:
<git diff --cached>
Return exactly:
PASS – if all rules satisfied
or
FAIL – if any rule violated
And give a brief justification (<40 words).


⸻

4. Directory Layout (MVP – Approach A)

/bouncer
 ├─ bouncer.js          # main script
 ├─ rules.md
 ├─ .bouncer.log.jsonl  # append-only audit trail
 ├─ .env                # GEMINI_API_KEY=...
 ├─ package.json
 └─ .husky/pre-commit   # git hook shim


⸻

5. Step-by-Step Implementation
	1.	Bootstrap

mkdir bouncer && cd $_
npm init -y
npm i @google/genai dotenv


	2.	Write rules.md (copy template above).
	3.	bouncer.js skeleton

#!/usr/bin/env node
import fs from "node:fs/promises";
import { execSync } from "node:child_process";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const AI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const diff = execSync("git diff --cached --unified=0", { encoding: "utf8" });
const rules = await fs.readFile(new URL("./rules.md", import.meta.url), "utf8");
const commit = execSync("git rev-parse --verify HEAD", { encoding: "utf8" }).trim();
const prompt = `SYSTEM:\n${rules}\n\nUSER:\nCommit ${commit || "<new>"} diff:\n${diff}`;

const res = await AI.models.generateContent({
  model: "gemini-2.5-flash-preview-04-17",
  contents: prompt,
  config: { temperature: 0.1, candidateCount: 1 }
});

const verdict = /PASS/i.test(res.text) ? "PASS" : "FAIL";
await fs.appendFile(
  ".bouncer.log.jsonl",
  JSON.stringify({ ts: new Date().toISOString(), commit, verdict, reason: res.text }) + "\n"
);

if (verdict === "FAIL") {
  console.error("\n🛑 Bouncer blocked this commit:\n" + res.text);
  process.exit(1);
} else {
  console.log("✅ Bouncer PASS");
}


	4.	Make executable

chmod +x bouncer.js


	5.	Install pre-commit hook (Husky)

npx husky install
npx husky add .husky/pre-commit "node ./bouncer.js"
git add .husky/pre-commit


	6.	First run

git add .
git commit -m "test"



⸻

6. Logging Format
	•	.bouncer.log.jsonl – one JSON per line.

{
  "ts": "2025-05-08T10:15:42Z",
  "commit": "a1b2c3d",
  "verdict": "FAIL",
  "reason": "FAIL – secret key found in diff..."
}



Rotate or gzip older logs if desired.

⸻

7. Edge-Cases & Hardening

Concern	Mitigation
Very large diff (> 100 k tokens)	Truncate with context markers; or chunk & multi-call
API outage / no key	Skip with warning or hard-fail (configurable)
Cost runaway	Count tokens locally via /countTokens endpoint or track x-goog-api-quota-... headers
Performance	Future option C daemon keeps streaming channel open


⸻

8. Roadmap After MVP
	1.	Configurable rule registry (YAML) & per-repo overrides.
	2.	Shared key vault – pull via gcloud secrets versions access.
	3.	Remote collector – push logs to a central Supabase table.
	4.	PR-level mode – GitHub Actions using same script.
	5.	Function-calling – ask Gemini to emit structured JSON verdict.

⸻

9. Troubleshooting Cheatsheet

Symptom	Likely Cause	Fix
TypeError: fetch failed	proxy, old Node	Use Node 18+; ensure global.fetch exists ￼
401 INVALID_ARGUMENT	bad API key	Regenerate in AI Studio → API keys
120 s timeout	Vercel/Edge runtime cap	Stream (generateContentStream) or split diff ￼


⸻

10. Appendix – Gemini Facts (offline reference)
	•	Model id: gemini-2.5-flash-preview-04-17
	•	Context window: 1 048 576 tokens in, 65 536 out ￼
	•	Default limits (Preview): 1 000 RPM / 1 000 000 TPM ￼
	•	Base URL (SDK handles): https://generativelanguage.googleapis.com/v1beta
	•	SDK Repo: https://github.com/google-gemini/cookbook – contains more Node examples.

⸻


---

### Next steps

1. Copy the file into `PLAN.md` and bootstrap the repo.
2. Hack on `rules.md` to reflect your actual coding commandments.
3. Commit something risky—watch Bouncer throw hands.

