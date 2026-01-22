# Backend Dockerfile for tcsAwsProject
# Multi-stage build for optimized image size

# Stage 1: Build
FROM node:16-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy TypeScript config and source code
COPY tsconfig.json ./
COPY src ./src

# Copy DocumentDB CA bundle
COPY global-bundle.pem ./global-bundle.pem

# Build TypeScript to JavaScript
RUN npm run build

# Stage 2: Production
FROM node:16-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
# Note: MCP packages are ESM and need to be available at runtime
RUN npm ci --only=production && npm cache clean --force

# Copy built files from builder stage
COPY --from=builder /app/build ./build

# Copy DocumentDB CA bundle from builder stage
COPY --from=builder /app/global-bundle.pem ./global-bundle.pem

# Copy any additional required files (if needed)
# COPY .env.example .env

# Expose the port your app runs on (adjust if different)
EXPOSE 4000

# Set environment to production
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start the application
CMD ["node", "build/index.js"]
