# AppForge

AppForge is an AI website builder: you describe a site in plain English, an LLM
classifies the project and generates a working React + TypeScript codebase, and the
resulting app runs **live in your browser** via WebContainer — with a split-pane editor,
file tree, and running preview — no third-party hosting needed for the generated site.

## Stack

- **Frontend** — `apps/fe`: Vite 5 + React 19 + TypeScript, Tailwind, shadcn/ui,
  Monaco editor, `@webcontainer/api` for in-browser runtime, `react-router-dom`.
  Cross-origin isolation (COOP/COEP) is required for WebContainer and is set in both
  dev (`vite.config.ts`) and prod (`apps/fe/serve.ts`).
- **Backend** — `apps/api`: Express 5 on Bun. Endpoints:
  - `POST /template` — classifies a prompt and returns a project template (non-streamed).
  - `POST /chat` — streams a full multi-file project generated from the prompt.
  - `GET /` — health (`{"status":"ok"}`).
  - OpenRouter-backed LLM calls (secret injected at deploy time, never committed).
- **Monorepo** — Turborepo + Bun workspaces; shared `packages/ui`, `packages/db`,
  `packages/typescript-config`, `packages/eslint-config`.

## Repo layout

```
apps/
  api/          Express + Bun backend (Dockerfile, PORT-aware)
  fe/           React SPA + bun static server (Dockerfile, serve.ts)
packages/
  ui/           shared UI components
  db/           (schema/types stubs)
  typescript-config/ eslint-config/
cloudbuild/
  api.yaml      Cloud Build steps: build+push image, gcloud run deploy appforge-api
  fe.yaml       same for appforge-fe (bakes VITE_BACKEND_URL)
deployment.md  GCP deployment plan + gotchas (gitignored, not in git)
```

## Local development

Requirements: Node >= 18, `bun` 1.x.

1. Set env files (copy from `.env.example`):
   - `apps/api/.env`: `OPENROUTER_API_KEY=...`
   - `apps/fe/.env`: `VITE_BACKEND_URL=http://localhost:3000`
2. Install + run:
   ```sh
   bun install
   bun run dev          # api on :3000, fe on :8080
   ```

## Scripts (from repo root)

```sh
bun run build        # turbo run build
bun run dev          # turbo run dev
bun run lint         # turbo run lint
bun run check-types  # turbo run check-types
bun run test         # turbo run test
```

## Production deployment

- Both services run on **Cloud Run** in `asia-south1` (scale-to-zero, memory/cpu
  sized to fit the free tier), images in Artifact Registry.
- **Continuous deployment**: a push to `main` fires Cloud Build triggers `api-deploy`
  and `fe-deploy`, which rebuild + redeploy both services automatically.
  (Cloud Build SA must be a user-managed SA; see `deployment.md` gotchas.)
- **Secrets**: `OPENROUTER_API_KEY` lives in Secret Manager
  (`openrouter_api_key`, asia-south1) and is injected via `--set-secrets`.
- **Custom domain**: Cloudflare DNS + a Cloudflare Worker reverse-proxy forwards
  the branded subdomains to the Cloud Run services (see `deployment.md` Phase 3.6).

### Live URLs

| Component | URL |
| --- | --- |
| Frontend | https://appforge.byaniket.site |
| Backend | https://appforge-api.byaniket.site |
| FE origin (Cloud Run) | https://appforge-fe-500273261728.asia-south1.run.app |
| API origin (Cloud Run) | https://appforge-api-500273261728.asia-south1.run.app |

### Deploying another project on byaniket.site

The one-time GCP + Cloudflare infra (zone, SSL, Search Console verification, worker
`appforge-proxy`, wildcard route `*byaniket.site/*`) is shared and already done. To put a
new project `N` at `N.byaniket.site` + `api-N.byaniket.site`: deploy its FE/API to Cloud Run
in asia-south1, add 2 proxied CNAMEs in the Cloudflare dashboard, and add 2 lines to the
worker's `ORIGINS` map. The full, self-contained runbook is `deployment.md` (gitignored):
copy it into the new project's local repo and point your opencode terminal at it
(see its "How to use this file" and Phase 3.7).

## Cost

Identical services at scale-to-zero + Cloud Build free tier + Cloudflare free plan +
OpenRouter (cents per call on DeepSeek models) → effectively ~$0/month.

## Notes / constraints

- Do **not** run `POST /template` or `POST /chat` casually — each OpenRouter call
  consumes credits. Ask before hitting them.
- Region policy: all GCP resources stay in `asia-south1` unless explicitly documented
  otherwise in `deployment.md`.