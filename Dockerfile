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

COPY index.js legacy-index.js meta-cloud-api.js qr-runtime.js ia-groq.js ia-groq-ext.js audio-groq.js autonomia.js conversation-core.js conversation-core-ext.js atendimento-fixes.js shekinah-info.js shekinah-forward.js shekinah-contact-guard.js catalogo-extra.js shekinah-ead.js ead-hook.js ead-inteligencia.js shekinah-ead-followup-guard.js ead-offer-sync-guard.js disable-gemini.js flow-cancel-guard.js ead-matricula-routing.js institution-router.js structured-flow-guard.js post-matricula-resume.js human-handoff-guard.js ead-direct-guard.js unifatecie-pagination-guard.js unifatecie-catalogo.js priority-router.js conversation-guard.js support-handoff-guard.js number-switch-guard.js event-repair-guard.js message-event-fallback.js connection-state-guard.js catalog-router-guard.js memory-bridge.js unifatecie-local-guard.js ead-price-guard.js ead-area-guard.js unifatecie-student-support.js unifatecie-student-support-v2.js light7-core.js human-attendant-style.js aizen-identity.js aizen-output-guard.js aizen-conversation-guard.js vision-groq.js one-time-session-reset.js outbound-safety-guard.js escola-avancada-api.js smoke-audio.js smoke-inteligencia.js smoke-regression-suite.js smoke-student-support-v2.js smoke-vision.js lanchonete-session.js lanchonete-v2.js lanchonete-standalone.js ./
RUN npm run check \
    && node --check lanchonete-session.js \
    && node --check lanchonete-v2.js \
    && node --check lanchonete-standalone.js \
    && mkdir -p /app/tokens/lanchonete

CMD ["npm", "start"]
