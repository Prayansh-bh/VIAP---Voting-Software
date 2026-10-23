# ==========================================
# Multi-Stage Production Dockerfile for Backend
# ==========================================

# Stage 1: Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install openssl and libc for Prisma engine compatibility
RUN apk add --no-cache openssl libc6-compat

# Copy dependency specifications
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy TypeScript configuration and source code
COPY tsconfig.json ./
COPY src ./src/

# Compile TypeScript to dist (dist/src/server.js)
RUN npx tsc

# Stage 2: Production runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

# Install runtime dependencies for Prisma engine
RUN apk add --no-cache openssl libc6-compat dumb-init

# Create non-root user and runtime directories
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /app/uploads /app/.baileys_auth && \
    chown -R nodejs:nodejs /app

# Copy dependency specifications and install production dependencies
COPY --chown=nodejs:nodejs package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy generated Prisma engine artifacts and schema
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# Copy compiled JavaScript output
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

USER nodejs

EXPOSE 4000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/server.js"]
