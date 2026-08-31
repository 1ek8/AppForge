FROM oven/bun:1.3.3 AS base
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/ apps/
COPY packages/ packages/

RUN bun install --frozen-lockfile

WORKDIR /app/apps/api
RUN bun run build

ENV NODE_ENV=production
CMD ["bun", "dist/index.js"]
