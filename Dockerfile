# ── 1. Asılılıqlar ─────────────────────────────────────────────
# pnpm 11 Node >= 22.13 tələb edir. pnpm corepack əvəzinə npm ilə dəqiq versiyada quraşdırılır
# (corepack-in köhnə imza açarları bəzən yeni pnpm buraxılışlarını rədd edir).
FROM node:22-alpine AS deps
RUN npm install -g pnpm@11.11.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ── 2. Build ──────────────────────────────────────────────────
FROM node:22-alpine AS build
RUN npm install -g pnpm@11.11.0
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_STANDALONE=1
RUN pnpm build

# ── 3. İşləmə mühiti ──────────────────────────────────────────
FROM node:22-alpine AS runner
# ffmpeg — videolardan metadata (GPS və s.) silmək üçün
RUN apk add --no-cache ffmpeg
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0

RUN addgroup -S app && adduser -S app -G app && mkdir -p /data/media && chown app:app /data/media
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/drizzle ./drizzle
COPY --from=build --chown=app:app /app/scripts/migrate.mjs ./scripts/migrate.mjs
# Standalone paketi (pnpm) postgres-i yalnız server kodunun .pnpm yolları ilə saxlayır, ayrıca skript onu tapmır.
# migrate.mjs üçün eyni versiyanı scripts/node_modules-a qoyuruq (asılılığı yoxdur, kiçikdir).
RUN cd scripts && echo '{"private":true}' > package.json && npm install --no-save --no-package-lock --omit=dev --no-audit --no-fund postgres@3.4.9 && chown -R app:app node_modules

USER app
EXPOSE 3000
# Hər başlanğıcda yeni migration-lar tətbiq olunur, sonra server açılır.
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
