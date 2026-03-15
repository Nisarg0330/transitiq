FROM node:20-alpine

WORKDIR /app

COPY services/api/package*.json ./
COPY services/api/tsconfig.json ./
RUN npm install

COPY services/api/src/ ./src/

RUN npm run build

EXPOSE 3001

CMD ["node", "dist/index.js"]