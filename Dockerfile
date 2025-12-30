# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Accept API key as build arg from Railway
ARG GEMINI_API_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build (Vite will read GEMINI_API_KEY from env)
COPY . .
RUN npm run build

# Production stage - use lightweight server
FROM node:20-alpine AS runner
WORKDIR /app

# Install serve for static file serving
RUN npm install -g serve

# Copy built assets only
COPY --from=builder /app/dist ./dist

# Railway sets PORT dynamically - use shell form to expand variable
CMD serve -s dist -l ${PORT:-4173}
