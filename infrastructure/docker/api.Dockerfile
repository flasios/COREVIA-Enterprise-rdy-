FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fetch-timeout 1800000 \
 && npm ci

COPY . .
RUN npm run build:client && npm run build:server
RUN npm prune --omit=dev && npm cache clean --force

FROM cgr.dev/chainguard/node:latest@sha256:bfa74c578dbf81b55db8f6cc30a9db6bf0021cfad05e1f016f9b4a97c7eba8af AS runtime
WORKDIR /app
ENV NODE_ENV=production

USER root
RUN ["/bin/rm", "-rf", "/usr/lib/node_modules/npm"]

COPY --from=build --chown=65532:65532 /app/node_modules ./node_modules
COPY --from=build --chown=65532:65532 /app/dist ./dist

USER 65532
EXPOSE 5000
CMD ["dist/index.js"]