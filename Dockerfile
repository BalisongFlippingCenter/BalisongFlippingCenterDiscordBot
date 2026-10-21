FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.js deploy-commands.js ./
COPY src ./src
COPY scripts ./scripts

ENV DB_PATH=/data/bot.db
RUN mkdir /data && chown node:node /data

USER node
CMD ["node", "index.js"]
