# Stage 1: Build production bundle
# Pinned by digest (Day 3). Node 22 matches CI; Node 20 reached end of life in April 2026.
# Refresh: docker buildx imagetools inspect node:22-alpine | grep -m1 Digest
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files and build
COPY . .
RUN npm run build

# Stage 2: Serve static files with ultra-lightweight Nginx
FROM nginx:alpine@sha256:df221db836e1754089190208cee7eeda94f233197056426eda74a43ab1abeac2 AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
