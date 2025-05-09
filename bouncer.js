#!/usr/bin/env node
import fs from "node:fs/promises";
import { execSync } from "node:child_process";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const AI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Retrieve the staged diff
const diff = execSync("git diff --cached --unified=0", { encoding: "utf8" });

// Retrieve the current commit hash
let commit;
try {
  commit = execSync("git rev-parse --verify HEAD", { encoding: "utf8" }).trim();
} catch (error) {
  // Handle case where there's no commit history yet
  commit = "<new>";
}

// Read rules from rules.md
const rules = await fs.readFile(new URL("./rules.md", import.meta.url), "utf8");

// Construct the prompt according to the format in PLAN.md
const prompt = `SYSTEM:
You are *Bouncer*, an uncompromising reviewer.
Enforce the following rules:
${rules}

USER:
Commit ${commit} diff:
${diff}
Return exactly:
PASS – if all rules satisfied
or
FAIL – if any rule violated
And give a brief justification (<40 words).`;

// Call the Gemini API with the prompt
const res = await AI.models.generateContent({
  model: "gemini-2.5-flash-preview-04-17",
  contents: prompt,
  config: { temperature: 0.1, candidateCount: 1 }
});

// Parse the response to determine the verdict (PASS or FAIL)
const verdict = /PASS/i.test(res.text) ? "PASS" : "FAIL";

// For verification/testing only - will be expanded in T010 with proper logging and exit code
console.log(`Verdict: ${verdict}`);
console.log(`Response: ${res.text.slice(0, 100)}${res.text.length > 100 ? '...' : ''}`);

// Now we have the verdict and response, the next step will be to:
// 1. Log the results (T010)
// 2. Exit with appropriate code based on verdict (T010)