FROM node:20-alpine AS builder

WORKDIR /app

COPY shared/package.json ./shared/
RUN cd shared && npm install
COPY shared/tsconfig.json ./shared/
COPY shared/src ./shared/src
RUN cd shared && npm run build

COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci
COPY server/tsconfig.json ./server/
COPY server/src ./server/src
RUN cd server && npm run build

FROM node:20-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY shared/package.json ./shared/
COPY --from=builder /app/shared/dist ./shared/dist
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/server/dist ./server/dist

WORKDIR /app/server
USER node
EXPOSE 2567

CMD ["node", "dist/index.js"]
