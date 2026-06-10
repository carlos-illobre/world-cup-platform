FROM node:22-alpine AS build

WORKDIR /app

COPY package.json bun.lock* package-lock.json* ./
RUN npm install

COPY . .

ARG VITE_INJURY_API_BASE_URL=http://localhost:8000
ENV VITE_INJURY_API_BASE_URL=$VITE_INJURY_API_BASE_URL

RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

COPY --from=build /app/.output /app/.output
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/package.json /app/package.json

EXPOSE 3000

CMD ["node", "/app/.output/server/index.mjs"]
