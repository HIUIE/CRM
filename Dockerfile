# Stage 1: Build Frontend
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production Server
FROM node:22-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts ./scripts

# Create data directory for uploads and local backups
RUN mkdir -p data/uploads data/backups

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
