# ─── Stage 1: build the React frontend ──────────────────────────────
FROM node:22-alpine AS webbuild
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# ─── Stage 2: server runtime ────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app/server

# better-sqlite3 ships prebuilt binaries for alpine; toolchain is a fallback.
RUN apk add --no-cache python3 make g++

COPY server/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && apk del python3 make g++

COPY server/tsconfig.json ./
COPY server/src ./src
COPY --from=webbuild /app/web/dist /app/web/dist

ENV NODE_ENV=production \
    PORT=4000 \
    DATA_DIR=/data

VOLUME /data
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1

CMD ["npx", "tsx", "src/index.ts"]
