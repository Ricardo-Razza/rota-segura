# syntax=docker/dockerfile:1
# Estágio 1: build de produção do Angular.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx ng build --configuration production

# Estágio 2: nginx servindo os estáticos e repassando /api para o backend.
FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/rota-segura-web/browser /usr/share/nginx/html
EXPOSE 80
# 127.0.0.1 e não localhost: no alpine, localhost resolve para ::1 e o nginx só escuta em IPv4.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO /dev/null http://127.0.0.1/ || exit 1
