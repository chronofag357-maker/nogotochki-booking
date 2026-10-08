FROM node:24.19.0-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public
RUN mkdir -p /data && chown node:node /data
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8792 DB_PATH=/data/booking.sqlite STUDIO_TIMEZONE=Europe/Moscow
VOLUME /data
EXPOSE 8792
CMD ["node", "server/http.js"]
