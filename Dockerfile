FROM node:22-bookworm-slim
RUN corepack enable && corepack prepare pnpm@9.5.0 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/tax/package.json packages/tax/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/api/prisma/schema.prisma apps/api/prisma/schema.prisma
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @norteluz/tax build && pnpm --filter @norteluz/api build
ENV NODE_ENV=production
EXPOSE 3001
CMD ["sh", "-c", "pnpm --filter @norteluz/api exec prisma db push && node apps/api/dist/main.js"]
