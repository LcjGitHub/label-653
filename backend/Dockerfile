FROM node:20-alpine

RUN apk add --no-cache \
    ttf-wqy-microhei \
    ttf-wqy-zenhei \
    fontconfig \
    && fc-cache -f

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production || npm install --only=production

COPY . .

RUN mkdir -p /app/data

ENV PORT=3002
ENV NODE_ENV=production

EXPOSE 3002

CMD ["node", "server.js"]
