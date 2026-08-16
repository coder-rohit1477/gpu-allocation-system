# Build context is the monorepo root, e.g.:
#   docker build -f apps/web/Dockerfile -t gpu-web .

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/config/package.json packages/config/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter "@gpu/web..." || pnpm install --filter "@gpu/web..."

FROM deps AS build
COPY packages/config packages/config
COPY packages/types packages/types
COPY packages/sdk packages/sdk
COPY packages/ui packages/ui
COPY apps/web apps/web
ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm --filter "@gpu/web..." run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
