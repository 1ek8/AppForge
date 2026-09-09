import express from "express";
import cors from "cors";
import type { Request } from "express";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const models: string[] = ['deepseek/deepseek-v4-flash-0731', 'cohere/north-mini-code:free', 'deepseek/deepseek-v3.2'];

const MAX_PROMPT_LENGTH = 4000;
const MAX_CONTEXT_LENGTH = 250_000;
const MAX_USER_CHANGES_LENGTH = 100_000;
const RATE_LIMIT = { windowMs: 60_000, max: 20 };
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: Request): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf) return cf;
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return req.ip || 'unknown';
}

function isRateLimited(req: Request): boolean {
  if (rateBuckets.size > 10_000) {
    const now = Date.now();
    for (const [key, bucket] of rateBuckets) {
      if (bucket.resetAt <= now) rateBuckets.delete(key);
    }
  }
  const key = clientKey(req);
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT.max;
}

import { OpenRouter } from '@openrouter/sdk';
import { getSystemPrompt } from './prompts/systemPrompt.ts';
import { templatePrompt } from "./prompts/templatePrompt.ts";
import { reactFileTree } from "./template/react.ts";
import { uiPrompt } from "./prompts/uiPrompt.ts";
import { nodeFileTree } from "./template/node.ts";

const openRouter = new OpenRouter({
  apiKey: OPENROUTER_API_KEY,
});

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '256kb' }));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});


app.post("/template", async (req, res) => {

  if (isRateLimited(req)) {
    res.status(429).json({ error: "Too many requests. Please try again shortly." });
    return;
  }

  try {
    
    const { prompt } = req.body;

    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      res.status(400).json({
        error: "Prompt needs to be passed properly as value to the prompt field in JSON"
      });
      return;
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      res.status(400).json({ error: `Prompt exceeds ${MAX_PROMPT_LENGTH} characters` });
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
    console.error("Template endpoint error:", error);
    res.status(500).json({ error: "Failed to generate template" });
  }

})

app.post('/chat', async(req, res) => {

  if (isRateLimited(req)) {
    res.status(429).json({ error: "Too many requests. Please try again shortly." });
    return;
  }

  try {

    const { userPrompt, prompts, context, userChanges } = req.body;

    if (typeof userPrompt !== "string" || userPrompt.trim().length === 0) {
      res.status(400).json({ error: "Prompt required" });
      return;
    }

    if (userPrompt.length > MAX_PROMPT_LENGTH) {
      res.status(400).json({ error: `Prompt exceeds ${MAX_PROMPT_LENGTH} characters` });
      return;
    }

    if ((!Array.isArray(prompts) || prompts.length === 0) && !context) {
      res.status(400).json({ error: "templates array or project context required" });
      return;
    }

    if (context !== undefined && (typeof context !== "string" || context.length > MAX_CONTEXT_LENGTH)) {
      res.status(400).json({ error: `Project context exceeds ${MAX_CONTEXT_LENGTH} characters` });
      return;
    }

    if (userChanges !== undefined && (typeof userChanges !== "string" || userChanges.length > MAX_USER_CHANGES_LENGTH)) {
      res.status(400).json({ error: `User modifications exceed ${MAX_USER_CHANGES_LENGTH} characters` });
      return;
    }

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: getSystemPrompt() },
      ...(Array.isArray(prompts) ? prompts.map((p: string) => ({ role: 'system' as const, content: p })) : []),
      ...(context ? [{ role: 'system' as const, content: context }] : []),
      { role: 'user', content: userChanges ? `${userChanges}\n\n${userPrompt}` : userPrompt }
    ];

    const result = await openRouter.callModel({
      models: models,
  
      input: messages

    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const delta of result.getTextStream()) {
      if (res.writableEnded) break;
      res.write(delta);
    }

    res.end();

  } catch (error) {
      console.error("Chat endpoint error:", error);
      if (res.headersSent) {
        res.write("\n\n[appforge-stream-error]\n");
        res.end();
        return;
      }
      res.status(500).json({ error: "Failed to generate response" });
  }

})

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`Server running on localhost:${port}`);
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
    maxOutputTokens: 1000
  });

  const template_text = await template_result.getText();
  console.log('Raw template repsonse: ', template_text);

  if (!template_text || template_text.trim() === '') {
    console.error('Empty response from LLM - likely rate limited or model unavailable');
    return PromptTemplate.OTHER;
  }

  const classification = template_text.trim().toLowerCase();
  console.log('Normalized classification: ', classification);

  if (classification.includes('node')) {
    return PromptTemplate.NODE;
  } else if (classification.includes('react')) {
    return PromptTemplate.REACT;
  } else {
    console.log('Classification failed, returning OTHER');
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