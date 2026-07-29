FROM node:20-alpine

WORKDIR /app

# shared 먼저 복사 (캐시 활용)
COPY shared/package.json ./shared/
RUN cd shared && npm install

COPY shared/ ./shared/

# client 의존성 설치
COPY client/package.json ./client/
RUN cd client && npm install

COPY client/ ./client/

WORKDIR /app/client

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
