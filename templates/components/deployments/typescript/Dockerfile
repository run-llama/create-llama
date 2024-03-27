FROM node:20-alpine as build

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml* /app/
RUN npm install 

# Build the application
COPY . .
RUN npm run build

# ====================================
FROM build as release

RUN chmod +x start.sh

CMD ["/bin/sh", "start.sh"]