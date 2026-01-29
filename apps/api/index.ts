require("dotenv-mono").load();

import express from "express";
import cors from "cors";

const OPENROUTER_API_KEY = process.env.QWEN_KEY;
const models: string[] = ['mistralai/devstral-2512:free', 'qwen/qwen3-coder:free', 'tngtech/deepseek-r1t2-chimera:free'];

import { OpenRouter } from '@openrouter/sdk';
import { getSystemPrompt } from './prompts/systemPrompt.ts';
import { templatePrompt } from "./prompts/templatePrompt.ts";
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

  try {
    
    const { prompt } = req.body;

    if(!prompt) {
      res.status(400).json({
        error: "Prompt needs to be passed properly as value to the prompt field in JSON"
      });
      return;
    }

    const classification = await classifyTemplate(prompt);

    const templatePrompts = getTemplatePrompts(classification);

    if (!Object.values(PromptTemplate).includes(classification as PromptTemplate)) {
      res.status(400).json({ 
        error: "Could not classify request. Only Node.js and React apps are supported."
      });
      return;
    }

    res.json({
      classification,
      userPrompt: prompt,
      templateLength: templatePrompts.length,
      prompts: templatePrompts  // Full prompts for chat endpoint
    });

  } catch (error) {

    res.status(500).json({ error: "Failed" });

  }

})

app.post('/chat', async(req, res) => {

  try {
    const { userPrompt, templateLength, prompts } = req.body;

    if (!userPrompt) {
      res.status(400).json({ error: "Prompt required" });
      return;
    }

    if (!prompts || templateLength === 0) {
      res.status(400).json({ error: "templates array required" });
      return;
    }
    
    const messages = [
      { role: 'system' as const, content: getSystemPrompt() },
      ...prompts.map((p:string) => ({ role: 'system' as const, content: p })),
      { role: 'user' as const, content: userPrompt }
    ];

    const result = await openRouter.callModel({
      models: models,
  
      input: messages

    });

    const selectedModel = result.getToolCalls;
    console.log(`Selected Model : ${selectedModel}`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const delta of result.getTextStream()) {
      // console.log(delta)
      process.stdout.write(delta);
      res.write(delta);
    }
    // for await (const delta of result.getTextStream()) {
    //   res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
    // }
    
    // res.write(`data: ${JSON.stringify({ done: true })}\n\n`);

    res.end();

  } catch (error) {
      console.error("Chat endpoint error:", error);
      res.end();
  }

})

app.listen(3000, () => {
  console.log("Server runnning on localhost:3000");
});

enum PromptTemplate {
  NODE = 'Node',
  REACT = 'React',
  OTHER = 'Other'
}

async function classifyTemplate(prompt: string): Promise<PromptTemplate> {
  try {
    const template_result = await openRouter.callModel({
    models: models,
    input: [
      {
        role: 'system',
        content: templatePrompt,
      },
      {
        role: 'user',
        content: prompt,
      }
    ],
    maxOutputTokens: 100
  });

  const template_text = await template_result.getText();
  console.log(template_text);
  const classification = template_text.trim().toLowerCase();

  if (classification.includes('node')) {
    return PromptTemplate.NODE;
  } else if (classification.includes('react')) {
    return PromptTemplate.REACT;
  } else {
    return PromptTemplate.OTHER;
  }
  } catch (error) {
    console.error("Classification error:", error);
    return PromptTemplate.OTHER;
  }
}

function getTemplatePrompts(classification: PromptTemplate): string[] {
  console.log(classification);
  switch (classification) {
    case PromptTemplate.NODE:
      return [nodeFileTree];
    case PromptTemplate.REACT:
      return [uiPrompt, reactFileTree];
    case PromptTemplate.OTHER:
    default:
      return [];
  }
}