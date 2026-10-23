FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json ./
RUN npm install --omit=optional --force

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

ENV NODE_ENV=production

EXPOSE 4000

CMD ["node", "dist/server.js"]