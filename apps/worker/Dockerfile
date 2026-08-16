# Build context is the monorepo root, e.g.:
#   docker build -f apps/worker/Dockerfile -t gpu-worker .

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/config/package.json packages/config/package.json
COPY packages/types/package.json packages/types/package.json
COPY apps/worker/package.json apps/worker/package.json
RUN pnpm install --frozen-lockfile --filter "@gpu/worker..." || pnpm install --filter "@gpu/worker..."

FROM deps AS build
COPY packages/config packages/config
COPY packages/types packages/types
COPY apps/worker apps/worker
RUN pnpm --filter "@gpu/worker..." run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo /repo
WORKDIR /repo/apps/worker
CMD ["node", "dist/index.js"]
