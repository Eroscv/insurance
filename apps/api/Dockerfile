FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-liberation ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/database/package.json packages/database/
COPY apps/api/package.json apps/api/
COPY packages ./packages
COPY apps/api ./apps/api
COPY tsconfig.base.json ./
RUN npm ci --workspace packages/shared --workspace packages/database --workspace apps/api --include-workspace-root
RUN npm run build:packages && npm run build -w apps/api

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/templates ./apps/api/templates
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["sh", "-c", "npx --workspace @insurance/database prisma migrate deploy && node dist/main.js"]
