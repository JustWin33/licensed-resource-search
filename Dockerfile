FROM node:24.17.0-alpine

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/worker/package.json ./apps/worker/package.json
COPY packages/cloud-drives/package.json ./packages/cloud-drives/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/search/package.json ./packages/search/package.json
COPY packages/tsconfig/package.json ./packages/tsconfig/package.json
COPY packages/ui/package.json ./packages/ui/package.json
RUN pnpm install --frozen-lockfile
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build pnpm db:generate
RUN pnpm build
RUN mkdir -p /opt/corepack && cp -R /root/.cache/node/corepack/. /opt/corepack/ && chmod -R a+rX /opt/corepack
ENV COREPACK_HOME=/opt/corepack

USER node
EXPOSE 3000
CMD ["node", "apps/web/node_modules/next/dist/bin/next", "start", "apps/web"]
