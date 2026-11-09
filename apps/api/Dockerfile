# Multi-stage Dockerfile untuk apps/api (NestJS)
# Mengikuti prinsip keamanan kontainer non-root

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# 1. Dependency installation
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --filter "@sistem-terintegrasi/api..."

# 2. Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

COPY packages/config ./packages/config
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY pnpm-workspace.yaml package.json ./

ENV NODE_ENV=production

RUN pnpm --filter "@sistem-terintegrasi/shared" run build
RUN pnpm --filter "@sistem-terintegrasi/api" run build

# 3. Production runner (Non-root user node bawaan image official)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install curl/wget untuk healthcheck jika diperlukan
RUN apk add --no-cache curl

# Salin dependencies produksi dan hasil build
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://127.0.0.1:4000/ready || exit 1

CMD ["node", "apps/api/dist/main.js"]

