# ===== Backend =====
FROM node:20-alpine AS backend-builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

RUN echo "registry=https://registry.npmmirror.com" > .npmrc && \
    echo "node-linker=hoisted" >> .npmrc && \
    echo "shamefully-hoist=true" >> .npmrc

RUN pnpm install --frozen-lockfile
RUN rm -rf apps/server/dist packages/shared/dist .turbo
RUN pnpm --filter @tokenpress/shared build
RUN pnpm --filter @tokenpress/server build

# Backend production
FROM node:20-alpine AS backend
WORKDIR /app

RUN apk add --no-cache python3 make g++ libc-dev

RUN echo "registry=https://registry.npmmirror.com" > .npmrc && \
    echo "node-linker=hoisted" >> .npmrc && \
    echo "shamefully-hoist=true" >> .npmrc

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY --from=backend-builder /app/apps/server/dist ./apps/server/dist
COPY --from=backend-builder /app/apps/server/package.json ./apps/server/
COPY --from=backend-builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=backend-builder /app/packages/shared/package.json ./packages/shared/
COPY --from=backend-builder /app/package.json ./
COPY --from=backend-builder /app/pnpm-lock.yaml ./
COPY --from=backend-builder /app/pnpm-workspace.yaml ./

# 安装生产依赖
RUN pnpm install --prod --frozen-lockfile

WORKDIR /app/apps/server
RUN mkdir -p data/uploads

ENV NODE_ENV=production
ENV PORT=4001

EXPOSE 4001

CMD ["node", "dist/index.js"]

# ===== Frontend =====
FROM node:20-alpine AS frontend-builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./
COPY packages/shared ./packages/shared

RUN echo "registry=https://registry.npmmirror.com" > .npmrc && \
    echo "node-linker=hoisted" >> .npmrc && \
    echo "shamefully-hoist=true" >> .npmrc

RUN pnpm install --frozen-lockfile

COPY apps/web ./apps/web

# 设置API相对路径，支持IP和域名访问
ENV NEXT_PUBLIC_API_URL=/api/v1
# Docker 内部后端地址（用于 rewrites）
ENV BACKEND_URL=http://backend:4001

# 清理 Next.js 缓存确保每次构建都是最新的
RUN rm -rf apps/web/.next

RUN pnpm --filter @tokenpress/web build

# Frontend production
FROM node:20-alpine AS frontend
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 复制构建产物和依赖
COPY --from=frontend-builder /app/apps/web ./apps/web
COPY --from=frontend-builder /app/packages/shared ./packages/shared
COPY --from=frontend-builder /app/package.json ./
COPY --from=frontend-builder /app/pnpm-lock.yaml ./
COPY --from=frontend-builder /app/pnpm-workspace.yaml ./
COPY --from=frontend-builder /app/node_modules ./node_modules

WORKDIR /app/apps/web

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["npx", "next", "start", "--port", "4000"]
