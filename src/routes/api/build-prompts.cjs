const fs = require('fs');
const path = require('path');

const lightPath = path.join(__dirname, '../../../prompt_light_1.md');
const fullPath = path.join(__dirname, '../../../prompt_full_1.md');
const sentencePath = path.join(__dirname, '../../../prompt_sentence_1.md');
const outputPath = path.join(__dirname, './-prompts.ts');

function escapePrompt(content) {
  // Strip standard markdown wrappers if the file has them, e.g. leading ``` and trailing ```
  let text = content.trim();
  // Escape backslashes first, then backticks and dollar signs to prevent ES6 template issues
  text = text.replace(/\\/g, '\\\\');
  text = text.replace(/`/g, '\\`');
  text = text.replace(/\${/g, '\\${');
  return text;
}

try {
  console.log('Reading prompts...');
  const lightContent = fs.readFileSync(lightPath, 'utf8');
  const fullContent = fs.readFileSync(fullPath, 'utf8');
  const sentenceContent = fs.readFileSync(sentencePath, 'utf8');

  // Format content to extract the inner block of prompt content (between the first ``` and the last ``` if present)
  function extractInner(text) {
    const lines = text.split('\n');
    let startIdx = -1;
    let endIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '```') {
        if (startIdx === -1) {
          startIdx = i;
        } else {
          endIdx = i;
        }
      }
    }
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      return lines.slice(startIdx + 1, endIdx).join('\n');
    }
    return text;
  }

  const cleanLight = extractInner(lightContent);
  const cleanFull = extractInner(fullContent);
  const cleanSentence = extractInner(sentenceContent);

  const fileContent = `// src/routes/api/-prompts.ts
// Generated automatically from prompt markdown files. Do not edit directly.

export const LIGHT_BREAKDOWN_PROMPT = \`${escapePrompt(cleanLight)}\`;

export const FULL_BREAKDOWN_PROMPT = \`${escapePrompt(cleanFull)}\`;

export const SENTENCE_BREAKDOWN_PROMPT = \`${escapePrompt(cleanSentence)}\`;
`;

  fs.writeFileSync(outputPath, fileContent, 'utf8');
  console.log('Successfully updated src/routes/api/-prompts.ts!');
} catch (err) {
  console.error('Error compiling prompts:', err);
  process.exit(1);
}
