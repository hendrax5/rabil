FROM node:20-alpine AS base

# Step 1: Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl python3 make g++ pkgconfig pixman-dev cairo-dev pango-dev jpeg-dev giflib-dev
WORKDIR /app

COPY package.json package-lock.json* ./
# Use npm install to ensure we get DevDependencies as they are needed for Prisma seeding (e.g. tsx, typescript)
RUN npm install

# Step 2: Build the source code
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Step 3: Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN apk add --no-cache openssl bash mariadb-client iproute2

COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copy built application and node modules (which includes tsx for seeding)
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

CMD ["docker-entrypoint.sh"]
