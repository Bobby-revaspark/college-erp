FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --include=dev && DATABASE_URL="mysql://build:build@localhost:3306/build" npm run db:generate
COPY . .
RUN npm run build
ENV NODE_ENV=production
USER node
CMD ["npm", "start"]
