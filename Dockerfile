# Build the frontend and install production dependencies in a throwaway
# stage, so the image that ships carries neither Vite nor the test tooling.
FROM node:22-bookworm-slim AS build

WORKDIR /app

# sqlite3 ships prebuilt binaries for this platform, but keep the toolchain
# available in case it has to compile.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev


FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=5050 \
    DB_PATH=/data/payroll.db \
    BACKUP_DIR=/data/backups

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server ./server
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/migrate.js /app/db.js /app/config.js ./

# The database and its backups live on a volume, not in the image — the whole
# point is that a redeploy never touches real payroll data.
VOLUME ["/data"]

RUN mkdir -p /data && chown -R node:node /data /app
USER node

EXPOSE 5050

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5050)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# server/index.js runs pending migrations (backing the database up first)
# before it starts listening.
CMD ["node", "server/index.js"]
