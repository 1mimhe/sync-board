# syntax=docker/dockerfile:1

# ---------- Stage 1: base ----------
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init openssl postgresql-client

# ---------- Stage 2: dependencies ----------
# Install production + dev dependencies and generate the Prisma client.
# This layer is cached separately so source changes don't re-trigger npm ci.
FROM base AS dependencies
COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npm ci --ignore-scripts && npx prisma generate

# ---------- Stage 3: development ----------
# Full sources mounted at runtime; Nest watches for changes via --watch.
FROM dependencies AS development
COPY . .
CMD ["dumb-init", "node", "--inspect=0.0.0.0:9229", "node_modules/.bin/nest", "start", "--watch"]

# ---------- Stage 4: build ----------
# Compile TypeScript and prune dev dependencies before shipping.
FROM dependencies AS build
COPY . .
RUN npm run build && npm prune --omit=dev

# ---------- Stage 5: migration ----------
# Lightweight image used by the db-init container in docker-compose.
# Has psql + prisma so it can push schema, run SQL, and seed — without
# running the application itself.
FROM dependencies AS migration
COPY . .
COPY docker/init-db.sh /usr/local/bin/init-db.sh
RUN chmod +x /usr/local/bin/init-db.sh
CMD ["init-db.sh"]

# ---------- Stage 6: production ----------
FROM base AS production
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

COPY --from=build --chown=nestjs:nodejs /app/dist        ./dist
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/prisma      ./prisma
COPY --from=build --chown=nestjs:nodejs /app/prisma.config.ts ./
COPY --from=build --chown=nestjs:nodejs /app/package.json ./
COPY --chown=nestjs:nodejs docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
    && mkdir -p /app/keys \
    && chown nestjs:nodejs /app/keys

USER nestjs

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["entrypoint.sh"]
# nest-cli sourceRoot "src" compiles to dist/src/main.js
CMD ["dumb-init", "node", "dist/src/main.js"]
