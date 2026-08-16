# Build context is the monorepo root, e.g.:
#   docker build -f apps/api/Dockerfile -t gpu-api .

FROM node:22-slim AS base
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/config/package.json packages/config/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter "@gpu/api..." || pnpm install --filter "@gpu/api..."

FROM deps AS build
COPY packages/config packages/config
COPY packages/types packages/types
COPY packages/sdk packages/sdk
COPY apps/api apps/api
RUN pnpm --filter "@gpu/api" run prisma:generate
RUN pnpm --filter "@gpu/api..." run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/index.js"]
