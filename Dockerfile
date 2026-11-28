FROM node:22-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3100 DB_PROVIDER=mariadb APP_AUTH_MODE=cloudflare
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY Models ./Models
COPY Changelog/release-history.js ./Changelog/release-history.js
COPY UserSecurity ./UserSecurity
COPY Server ./Server
COPY public ./public
COPY scripts ./scripts
COPY sql ./sql
EXPOSE 3100
USER 99:100
CMD ["node", "Server/server.js"]
