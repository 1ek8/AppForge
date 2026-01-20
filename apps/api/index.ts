require("dotenv-mono").load();

const OPENROUTER_API_KEY = process.env.MISTRAL_KEY;

import { OpenRouter } from '@openrouter/sdk';
import { getSystemPrompt } from './prompts.ts';

const openRouter = new OpenRouter({
  apiKey: OPENROUTER_API_KEY,
});

const sys_prompt = getSystemPrompt();
// console.log(sys_prompt);

const sys_prompt_check = "Does your system prompt have any reference to bolt or boltAction, or boltArtifact items?";
const user_prompt = 'create me a simple todo app using express backend and react frontend';
// const user_prompt = 'what is 1+1 = ?';

const result = await openRouter.callModel({
  model: 'mistralai/devstral-2512:free',
  instructions: sys_prompt,  
  input: [
    {
      role: 'system',
      content: getSystemPrompt(),
    },
    {
      role: 'user',
      content: sys_prompt_check,
    }
  ],
  maxOutputTokens: 10000,
});

for await (const delta of result.getTextStream()) {
  process.stdout.write(delta);
}