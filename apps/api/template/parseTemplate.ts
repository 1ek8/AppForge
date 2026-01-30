// import { chatRepsonse } from "./chatResponse.ts";
import { nodeFileTree } from "./node.ts";
import { reactFileTree } from "./react.ts";
import * as fs from 'fs';
import * as path from 'path';

interface FileStructure {
  id: string;
  title: string;
  files: Array<{
    type: string;
    filePath: string;
    content: string;
  }>;
}

export function parseXmlPrompt(prompt: string): FileStructure | null {
  // Step 1: Extract XML portion from the prompt
  const xmlMatch = prompt.match(/<boltArtifact[^>]*>[\s\S]*?<\/boltArtifact>/);
  
  if (!xmlMatch) {
    return null;
  }
  
  const xmlString = xmlMatch[0];
  
  // Step 2: Parse boltArtifact attributes
  const artifactMatch = xmlString.match(/<boltArtifact\s+id="([^"]*)"\s+title="([^"]*)"/);
  
  if (!artifactMatch) {
    return null;
  }
  
  // const [, id, title] = artifactMatch;
  const id = artifactMatch[1] ?? "";
  const title = artifactMatch[2] ?? "";
  
  // Step 3: Extract all boltAction elements
  const actionRegex = /<boltAction\s+type="([^"]*)"\s+filePath="([^"]*)">([\s\S]*?)<\/boltAction>/g;
  const files: Array<{ type: string; filePath: string; content: string }> = [];
  
  let match;
  while ((match = actionRegex.exec(xmlString)) !== null) {
    // const [, type, filePath, content] = match;
    const type = match[1] ?? "";
    const filePath = match[2] ?? "";
    const content = (match[3] ?? "").trim();
    files.push({
      type,
      filePath,
      content: content.trim()
    });
  }
  
  // Step 4: Return JSON structure
  return {
    id,
    title,
    files
  };
}

// Usage example
// function main() {
//   const nodeResult = parseXmlPrompt(nodeFileTree);
  // const reactResult = parseXmlPrompt(reactFileTree);
  const rawPrompt = fs.readFileSync(path.join(__dirname, 'chatResponse.txt'), 'utf-8');

  const chatResult = parseXmlPrompt(rawPrompt);
  
  // console.log('Node Files:', JSON.stringify(nodeResult, null, 2));
  console.log('Chat Files:', JSON.stringify(chatResult, null, 2));
//   console.log('React Files:', JSON.stringify(reactResult, null, 2));
  
  // return { nodeResult };
// }
