require("dotenv-mono").load();

import express from "express";
import cors from "cors";

const OPENROUTER_API_KEY = process.env.MISTRAL_KEY;

import { OpenRouter } from '@openrouter/sdk';
import { getSystemPrompt } from './prompts/systemPrompt.ts';
import { getTemplatePrompt } from "./prompts/templatePrompt.ts";
import { reactFileTree } from "./template/react.ts";
import { uiPrompt } from "./prompts/uiPromot.ts";
import { nodeFileTree } from "./template/node.ts";

const openRouter = new OpenRouter({
  apiKey: OPENROUTER_API_KEY,
});

const app = express();
app.use(express.json());
app.use(cors());


app.post("/template", async (req, res) => {
  const template_prompt = req.body.prompt;

  const template_result = await openRouter.callModel({
    model: 'mistralai/devstral-2512:free',
    // instructions: sys_prompt,  
    input: [
      {
        role: 'system',
        content: getTemplatePrompt,
      },
      {
        role: 'user',
        content: template_prompt,
      }
    ],
    maxOutputTokens: 100
  });

  const template_text = await template_result.getText();

  if(template_text === "Node") {
    res.json({
      prompts: [nodeFileTree]
    })
    return;
  } 
  else if (template_text === "React") {
    res.json({
      prompts: [
        uiPrompt,
        reactFileTree
      ]
    })
    return;
  } 
  else {
    res.status(403).json({message: "This system only supports Node or React apps"});
    return;
  }

})

app.post('/chat', async(req, res) => {
  const sys_prompt = getSystemPrompt();
  const user_prompt = 'create me a simple todo app using express backend and react frontend';

  const result = await openRouter.callModel({
    model: 'mistralai/devstral-2512:free',
    // instructions: sys_prompt,  
    input: [
      {
        role: 'system',
        content: getSystemPrompt(),
      },
      {
        role: 'user',
        content: user_prompt,
      }
    ],
    // maxOutputTokens: 10000,
  });

  for await (const delta of result.getTextStream()) {
    process.stdout.write(delta);
  }
})


app.listen(3000);