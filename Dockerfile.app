# TODO pin Node version so the image isn't constantly updating under us?
FROM node:12
WORKDIR /usr/app
COPY ./package.json .
COPY ./yarn.lock .
RUN yarn
COPY . .
CMD ["sh", "-c",  "yarn start-without-env"]
