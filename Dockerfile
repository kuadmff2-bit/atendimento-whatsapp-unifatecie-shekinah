FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    TZ=America/Manaus \
    CHROME_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      chromium \
      fonts-liberation \
      fonts-noto-color-emoji \
      tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev \
    && npm cache clean --force

COPY index.js legacy-index.js qr-runtime.js ia-groq.js ia-groq-ext.js audio-groq.js autonomia.js conversation-core.js conversation-core-ext.js atendimento-fixes.js shekinah-info.js shekinah-forward.js catalogo-extra.js shekinah-ead.js ead-hook.js ead-inteligencia.js flow-cancel-guard.js ead-matricula-routing.js institution-router.js structured-flow-guard.js escola-avancada-api.js smoke-inteligencia.js ./
RUN npm run check \
    && mkdir -p /app/tokens

CMD ["npm", "start"]
