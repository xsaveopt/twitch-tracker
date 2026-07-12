FROM node:24 AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY . .

FROM node:24-slim AS runner
WORKDIR /app
COPY --from=build /app .
RUN set -xe \
    && chown -R node:node /app \
    && rm -rf /root /opt/* /tmp/* /var/cache/* /var/log/* /var/spool/* /var/lib/systemd

FROM scratch AS final
COPY --from=runner / /
WORKDIR /app
USER node
CMD ["node", "src/server.ts"]
