require("dotenv-mono").load();

// console.log(process.env.API_KEY)
const OPENROUTER_API_KEY = process.env.API_KEY;

import { OpenRouter } from '@openrouter/sdk';
import { getSystemPrompt } from './prompts.ts';

const openRouter = new OpenRouter({
  apiKey: OPENROUTER_API_KEY,
//   defaultHeaders: {
//     'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
//     'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
//   },
});

const completion = await openRouter.chat.send({
  model: 'google/gemini-2.5-flash',
  system: getSystemPrompt(),
  messages: [
    {
      role: 'user',
      content: 'What is 2+2 = ?',
    }
  ],
  maxTokens: 64,
  stream: false,
});

console.log(completion.choices[0]!.message.content);
