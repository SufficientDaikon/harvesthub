# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
COPY api/ ./api/
COPY scripts/ ./scripts/
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app

# Install Python, pip, build tools for native extensions, and curl for healthcheck
RUN apk add --no-cache python3 py3-pip curl build-base python3-dev libffi-dev

# Install Python dependencies
RUN pip3 install --no-cache-dir --break-system-packages scrapling curl_cffi orjson browserforge

# Copy production Node.js deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built code from builder
COPY --from=builder /app/dist ./dist

# Copy runtime assets
COPY engine/ ./engine/
COPY dashboard/ ./dashboard/

# Ensure data directories exist
RUN mkdir -p data/store data/exports data/logs

# Non-root user
RUN addgroup -S harvesthub && adduser -S harvesthub -G harvesthub
RUN chown -R harvesthub:harvesthub /app
USER harvesthub

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["node", "dist/cli/index.js", "dashboard", "-p", "4000"]
