FROM node:24.17.0-alpine

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm build

USER node
EXPOSE 3000
CMD ["pnpm", "--filter", "@platform/web", "start"]
