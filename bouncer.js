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