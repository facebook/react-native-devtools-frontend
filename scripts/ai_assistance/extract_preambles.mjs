// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import fs from 'node:fs';
import path from 'node:path';

/**
 * Script to extract preambles from DevTools AI agents and generate a markdown summary.
 * To run: node scripts/ai_assistance/extract_preambles.mjs
 * Note: this is a best effort script! You should ensure you manually check the data looks accurate and aligns.
 */

const agentsDir = path.join(import.meta.dirname, '../../front_end/models/ai_assistance/agents');
const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('Agent.ts'));

let markdown = '# DevTools AI Agents Preambles\n\n';

for (const file of files) {
  const content = fs.readFileSync(path.join(agentsDir, file), 'utf-8');

  // Identify the Agent class name
  const classMatch = content.match(/class\s+(\w+Agent)\s+extends\s+AiAgent/);
  if (!classMatch) {
    continue;
  }
  const agentName = classMatch[1];

  // Try to extract the preamble string.
  // 1. Matches variable assignments like `const preamble = `...`;` or `let preamble = `...`;`
  // 2. Matches `const callTreePreamble = `...`;`
  // 3. Matches specific return statements in functions (for PerformanceAgent)
  const preambleRegex =
      /(?:const|let)\s+[a-zA-Z]*[pP]reamble\s*=\s*`([\s\S]*?)`;|return\s*`(You are an assistant[\s\S]*?)`;/;
  const preambleMatch = content.match(preambleRegex);

  if (preambleMatch) {
    const preambleText = (preambleMatch[1] || preambleMatch[2])
                             // Remove template literal interpolations ${...}
                             .replace(/\$\{[\s\S]*?\}/g, '')
                             // Collapse 3+ newlines into 2
                             .replace(/\n{3,}/g, '\n\n')
                             .trim();
    markdown += `## ${agentName}\n\n\`\`\`text\n${preambleText}\n\`\`\`\n\n`;
  } else {
    markdown += `## ${agentName}\n\n*Preamble not found or uses complex logic.*\n\n`;
  }
}

const outputPath = path.join(import.meta.dirname, 'agent_preambles.md');
fs.writeFileSync(outputPath, markdown);
console.log(`Successfully generated ${outputPath}`);
