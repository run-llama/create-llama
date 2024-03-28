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

# Copy built output from the previous stage
COPY --from=build /app/.next* ./.next
COPY --from=build /app/public* ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules

CMD ["npm", "start"]