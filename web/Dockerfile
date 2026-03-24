FROM node:20-alpine

WORKDIR /app

COPY package.json yarn.lock ./
COPY api/package.json ./api/package.json
COPY web/package.json ./web/package.json
COPY shared/package.json ./shared/package.json

RUN yarn install

COPY . .

EXPOSE 5173
