# ============================================
# DOCKERFILE - WhatsApp Bot & API Server
# ============================================

FROM node:20-alpine

# Install dependencies untuk Puppeteer (dibutuhkan oleh whatsapp-web.js)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set environment untuk Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY . .

# Create directory untuk WhatsApp session
RUN mkdir -p .wwebjs_auth

# Expose port untuk API
EXPOSE 3000

# Start command (akan di-override di docker-compose)
CMD ["node", "index.js"]
