#\!/usr/bin/env node

// Script to generate a large test file for testing diff truncation

const fs = require('fs');

// Create a large repeating pattern
const line = "This is a test line that will be repeated many times to create a large file for testing diff truncation.\n";
const repeatCount = 100000; // This should generate a file of several MB

// Generate the content
let content = '';
for (let i = 0; i < repeatCount; i++) {
  content += `Line ${i}: ${line}`;
}

// Write to file
fs.writeFileSync('large-test-file.txt', content);

console.log(`Created large test file (${content.length} characters, approximately ${Math.ceil(content.length / 3.5)} tokens)`);
