# Estagio 1: Build do Front-end (React + Vite)
FROM node:24-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Estagio 2: Build do Back-end (NestJS + Prisma)
FROM node:24-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
COPY backend/prisma ./prisma/
RUN npm install
COPY backend/ ./
RUN npx prisma generate
RUN npm run build

# Estagio 3: Runner Final de Producao Unificada
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl libc6-compat

COPY backend/package*.json ./
COPY backend/prisma.config.ts ./
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/prisma ./prisma
COPY --from=frontend-builder /app/frontend/dist ./dist/public

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run db:seed && node dist/main.js"]

