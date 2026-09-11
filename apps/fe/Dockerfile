FROM oven/bun:1.3.3 AS build
WORKDIR /app

ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

COPY package.json bun.lock ./
COPY apps/ apps/
COPY packages/ packages/

RUN bun install --frozen-lockfile

WORKDIR /app/apps/fe
RUN bun run build

FROM oven/bun:1.3.3 AS runtime
WORKDIR /app

COPY --from=build /app/apps/fe/dist ./dist
COPY --from=build /app/apps/fe/serve.ts ./serve.ts

ENV NODE_ENV=production
EXPOSE 8080
CMD ["bun", "serve.ts"]