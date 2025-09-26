# Multi-stage Dockerfile for Next.js 15 (App Router) with standalone output

# 1) Base deps for building
FROM node:20-alpine AS deps
WORKDIR /app

# Install OS deps if needed (e.g., for sharp). Not required here, but keep as hint.
# RUN apk add --no-cache libc6-compat

# Install dependencies based on lockfile if present
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN \
  if [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then npm -g install pnpm && pnpm i --frozen-lockfile; \
  elif [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  else npm i; fi


# 2) Build stage
FROM node:20-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure Next.js uses standalone output; can be enforced via next.config.ts as well
RUN npm run build


# 3) Runtime image (standalone)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy standalone build output
COPY --from=builder /app/.next/standalone .
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# If you serve images or other static files from /public, they're now present

USER nextjs
EXPOSE 3000

# Start Next.js standalone server
CMD ["node", "server.js"]
