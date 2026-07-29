FROM node:20-alpine

WORKDIR /app

# shared 먼저 복사 (캐시 활용)
COPY shared/package.json ./shared/
RUN cd shared && npm install

COPY shared/ ./shared/

# server 의존성 설치
COPY server/package.json ./server/
RUN cd server && npm install

COPY server/ ./server/

WORKDIR /app/server

EXPOSE 2567

CMD ["npm", "run", "dev"]
