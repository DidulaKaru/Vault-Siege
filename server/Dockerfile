# syntax=docker/dockerfile:1
FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund

FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node . .
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
USER node
EXPOSE 5000
CMD ["node", "index.js"]
