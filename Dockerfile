# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .



# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app



# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist


# COPY server/keys ./keys



# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose the port (GCP Cloud Run uses PORT env variable)
EXPOSE 8080



# Start the application
CMD ["node", "dist/index.cjs"]
