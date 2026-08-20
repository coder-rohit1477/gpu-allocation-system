# DEV/DEMO ONLY image — not part of the production topology (see
# docker-compose.demo.yml, never docker-compose.prod.yml).
# Build context is the monorepo root, e.g.:
#   docker build -f apps/demo-telemetry-simulator/Dockerfile -t gpu-demo-telemetry-simulator .

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/config/package.json packages/config/package.json
COPY apps/demo-telemetry-simulator/package.json apps/demo-telemetry-simulator/package.json
RUN pnpm install --frozen-lockfile --filter "@gpu/demo-telemetry-simulator..." \
  || pnpm install --filter "@gpu/demo-telemetry-simulator..."

FROM deps AS build
COPY packages/config packages/config
COPY apps/demo-telemetry-simulator apps/demo-telemetry-simulator
RUN pnpm --filter "@gpu/demo-telemetry-simulator..." run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build --chown=node:node /repo /repo
WORKDIR /repo/apps/demo-telemetry-simulator
# Non-root — this container only ever makes outbound HTTP calls, no
# elevated privileges of any kind are needed.
USER node
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "healthcheck.mjs"]
CMD ["node", "dist/index.js"]
