FROM node:14-alpine

ENV NODE_ENV=production

WORKDIR /app
COPY package*.json .
RUN yarn install --production
COPY . .
EXPOSE 3000
