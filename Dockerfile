FROM node:16-alpine

ENV NODE_ENV=production

WORKDIR /app
COPY package.json .
COPY yarn.lock .
RUN npm install -g supervisor
RUN yarn install --production
COPY . .
EXPOSE 3000