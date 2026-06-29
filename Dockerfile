# Node + the shared libraries Puppeteer's bundled Chromium needs.
# Debian's package set is version-matched, so the FreeType/HarfBuzz
# "FT_Get_Transform" clash you hit on Amazon Linux 2023 cannot happen here.
FROM node:20-slim

# Chromium runtime dependencies + a base font family for clean text.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (Puppeteer downloads its matching Chromium here).
COPY package*.json ./
RUN npm install --omit=dev

# App code + the report assets (support.js, image-slot.js, *.png).
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
