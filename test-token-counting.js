#!/usr/bin/env node
// Test script for token counting in bouncer.js

import { GoogleGenAI } from "@google/genai";
import fs from "node:fs/promises";
import "dotenv/config";

// Check if API key exists
if (!process.env.GEMINI_API_KEY) {
  console.error("Missing Gemini API key. Set it in .env or as an environment variable.");
  process.exit(1);
}

const AI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testTokenCounting() {
  console.log("Testing Token Counting with Gemini API\n");
  
  // Sample texts of different sizes
  const samples = [
    { name: "Very small", text: "Hello world" },
    { name: "Small paragraph", text: "This is a test paragraph with multiple sentences. It should contain a reasonable number of tokens. We'll use this to verify the token counting functionality works correctly." },
    { name: "Medium content", text: fs.readFile("./rules.md", "utf8") }
  ];
  
  for (const sample of samples) {
    try {
      console.log(`Sample: ${sample.name}`);
      
      // Get the text (resolve promise if needed)
      const text = typeof sample.text === 'string' ? sample.text : await sample.text;
      
      // Count characters
      console.log(`Characters: ${text.length}`);
      
      // Count tokens using Gemini API
      const countTokensResponse = await AI.models.countTokens({
        model: "gemini-2.5-flash-preview-04-17",
        contents: text,
      });
      
      // Display result
      console.log(`Tokens: ${countTokensResponse.totalTokens}`);
      console.log(`Characters per token: ${(text.length / countTokensResponse.totalTokens).toFixed(2)}`);
      console.log("---");
    } catch (error) {
      console.error(`Error processing ${sample.name}: ${error.message}`);
    }
  }
  
  console.log("\nTest a complete API call with usage metadata:");
  try {
    const response = await AI.models.generateContent({
      model: "gemini-2.5-flash-preview-04-17",
      contents: "Summarize the concept of token counting in AI models in one sentence.",
    });
    
    console.log(`Response: ${response.text}`);
    console.log("Usage metadata:", response.usageMetadata);
  } catch (error) {
    console.error(`API call error: ${error.message}`);
  }
}

testTokenCounting().catch(console.error);