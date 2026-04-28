FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN node infrastructure/scripts/build-ai-service.mjs
RUN npm prune --omit=dev && npm cache clean --force

FROM cgr.dev/chainguard/node:latest@sha256:bfa74c578dbf81b55db8f6cc30a9db6bf0021cfad05e1f016f9b4a97c7eba8af AS runtime
WORKDIR /app
ENV NODE_ENV=production

USER root
RUN ["/bin/rm", "-rf", "/usr/lib/node_modules/npm"]

COPY --from=build --chown=65532:65532 /app/node_modules ./node_modules
COPY --from=build --chown=65532:65532 /app/dist/ai-service ./dist/ai-service

USER 65532
EXPOSE 8080
CMD ["dist/ai-service/index.js"]