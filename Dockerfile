# ===== Backend =====
FROM node:20-alpine AS backend-builder
WORKDIR /app

# 使用 npm 安装 pnpm（配置淘宝镜像加速）
RUN npm config set registry https://registry.npmmirror.com && \
    npm install -g pnpm@9.15.0

# better-sqlite3 需要原生编译（python3 + 构建工具），builder 阶段安装依赖时必须可用
RUN apk add --no-cache python3 make g++ libc-dev

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

RUN rm -f .npmrc && \
    echo "registry=https://registry.npmmirror.com" > .npmrc && \
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

RUN npm config set registry https://registry.npmmirror.com && \
    npm install -g pnpm@9.15.0

COPY --from=backend-builder /app/apps/server/dist ./apps/server/dist
COPY --from=backend-builder /app/apps/server/src/db/defaults ./apps/server/dist/db/defaults
# 内置模板包（buildin styles）：构建期拷入镜像，运行时由 initBuiltinStyles 拷贝进持久卷
COPY apps/web/public/styles ./apps/server/styles-builtin
# 内置欢迎页预置（welcome*.html）：构建期拷入镜像，运行时由 initBuiltinStaticHtml 拷贝进 statichtml 持久卷
COPY apps/server/statichtml-presets ./apps/server/statichtml-presets
COPY --from=backend-builder /app/apps/server/package.json ./apps/server/
COPY --from=backend-builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=backend-builder /app/packages/shared/package.json ./packages/shared/
COPY --from=backend-builder /app/package.json ./
COPY --from=backend-builder /app/pnpm-lock.yaml ./
COPY --from=backend-builder /app/pnpm-workspace.yaml ./

# 安装生产依赖
RUN pnpm install --prod --frozen-lockfile

WORKDIR /app/apps/server
RUN mkdir -p data/uploads data/statichtml data/styles

ENV NODE_ENV=production
ENV PORT=4001

EXPOSE 4001

CMD ["node", "dist/index.js"]

# ===== Frontend =====
FROM node:20-alpine AS frontend-builder
WORKDIR /app
RUN npm config set registry https://registry.npmmirror.com && \
    npm install -g pnpm@9.15.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./
COPY packages/shared ./packages/shared

RUN rm -f .npmrc && \
    echo "registry=https://registry.npmmirror.com" > .npmrc && \
    echo "node-linker=hoisted" >> .npmrc && \
    echo "shamefully-hoist=true" >> .npmrc

RUN pnpm install --frozen-lockfile

# frontend 也依赖 @tokenpress/shared（tokens 等后台页直接 import），必须先在镜像内构建其 dist
# （backend 阶段第 24 行已 build shared；frontend 阶段此前漏掉，导致 @tokenpress/shared 解析失败）
RUN pnpm --filter @tokenpress/shared build

COPY apps/web ./apps/web

# 设置API相对路径为空，客户端使用相对路径走 nginx 代理
ENV NEXT_PUBLIC_API_URL=
# Docker 内部后端地址（用于 rewrites 和 SSR）
ENV BACKEND_URL=http://backend:4001

# 清理 Next.js 缓存确保每次构建都是最新的
RUN rm -rf apps/web/.next

RUN pnpm --filter @tokenpress/web build

# Frontend production
FROM node:20-alpine AS frontend
WORKDIR /app

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
# Docker 内部后端地址（用于 SSR 和 rewrites）
ENV BACKEND_URL=http://backend:4001
# 客户端使用相对路径（已在构建时嵌入）
ENV NEXT_PUBLIC_API_URL=

EXPOSE 4000

CMD ["npx", "next", "start", "--port", "4000"]
