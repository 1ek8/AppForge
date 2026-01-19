require("dotenv-mono").load();

// console.log(process.env.API_KEY)
const OPENROUTER_API_KEY = process.env.MISTRAL_KEY;

import { OpenRouter } from '@openrouter/sdk';
import { getSystemPrompt } from './prompts.ts';

const openRouter = new OpenRouter({
  apiKey: OPENROUTER_API_KEY,
//   defaultHeaders: {
//     'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
//     'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
//   },
});

const user_prompt = 'create me a simple todo app using express backend and react frontend';
// const user_prompt = 'what is 1+1 = ?';

const stream = await openRouter.chat.send({
  model: 'mistralai/devstral-2512:free',
  system: getSystemPrompt(),
  messages: [
    {
      role: 'user',
      content: user_prompt,
    }
  ],
  maxTokens: 10000,
  stream: true,
  streamOptions: { includeUsage: true }
});

let fullContent = '';

console.log(stream);

for await (const chunk of stream) {
  const content = chunk.choices?.[0]?.delta?.content;
  if (content) {
    fullContent += content; // Accumulate instead of immediate print
    process.stdout.write(content);
    // console.log(content);
  }
  // Final chunk includes usage stats
  if (chunk.usage) {
    console.log('Usage:', chunk.usage);
  }
}
console.log('\n\nFull Response:', fullContent); // Print full buffered response

// console.log(stream.choices[0]!.message.content);
