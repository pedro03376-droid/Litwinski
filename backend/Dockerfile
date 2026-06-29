FROM node:20-alpine AS development

WORKDIR /app

# --include=dev so nest CLI + typescript install even if NODE_ENV=production
# is injected at build time (otherwise `nest build` fails / produces no dist).
COPY package*.json ./
RUN npm ci --include=dev

COPY . .

RUN npm run build && test -f dist/main.js

FROM node:20-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=development /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]
