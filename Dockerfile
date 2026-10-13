# Сборка: зависимости, тесты, vite build → dist/
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Аналитика Umami (публичные значения, попадают в index.html). Переопределяются build-переменными.
ARG UMAMI_URL=https://umami.musabii.dev
ARG UMAMI_WEBSITE_ID=58ad71b8-f5a8-48bf-82a3-daedb62f20b6
ARG UMAMI_DOMAINS=edoview.musabii.dev
RUN npm test && npm run build

# Раздача статики: nginx с gzip и вечным кэшем для assets/
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
