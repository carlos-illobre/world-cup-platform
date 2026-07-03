FROM node:22-alpine AS base

WORKDIR /app

COPY package.json bun.lock* package-lock.json* ./
RUN npm install

# --- Development Stage ---
FROM base AS development
# We don't copy the full code here if we expect it to be mounted via docker-compose
# But we copy it just in case someone runs the target without volume mounts
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

# --- Build Stage ---
FROM base AS build

COPY . .

ARG VITE_INJURY_API_BASE_URL
ENV VITE_INJURY_API_BASE_URL=$VITE_INJURY_API_BASE_URL

RUN npm run build

# --- Runtime Stage ---
FROM node:22-alpine AS runtime

WORKDIR /app

# Copiar archivos asignándoles propiedad al usuario 'node'
COPY --from=build --chown=node:node /app/.output /app/.output
COPY --from=build --chown=node:node /app/node_modules /app/node_modules
COPY --from=build --chown=node:node /app/package.json /app/package.json

# Cambiar al usuario seguro preexistente en Alpine Node
USER node

EXPOSE 3000

CMD ["node", "/app/.output/server/index.mjs"]
