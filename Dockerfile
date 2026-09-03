FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /app
COPY package.json .
COPY yarn.lock .
RUN yarn install --production
COPY . .
EXPOSE 3000
