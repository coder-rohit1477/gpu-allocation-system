FROM node:20-alpine

WORKDIR /app

# Copy package files first to leverage Docker layer cache
COPY package*.json ./

# Use npm ci for reproducible, deterministic installs
RUN npm ci --include=dev

# Copy application source AFTER installing deps
COPY . .

# Switch to non-root user after copy (avoids permission errors)
USER node

EXPOSE 5001

CMD ["node", "app.js"]
