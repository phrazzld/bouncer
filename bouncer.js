#!/usr/bin/env node
import fs from "node:fs/promises";
import { execSync } from "node:child_process";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const AI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });