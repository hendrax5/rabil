FROM node:20-bullseye-slim

# Install OpenSSL for Prisma and Git for npm dependencies
RUN apt-get update && apt-get install -y openssl git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the root prisma folder to generate DB client correctly
COPY ./prisma ./prisma

# Copy only the microservice package.json
COPY ./src/microservices/whatsapp-engine/package*.json ./

# Install microservice dependencies
RUN npm install

# Generate a local Prisma client inside /app/node_modules
RUN npx prisma generate

# Copy the rest of the microservice source code
COPY ./src/microservices/whatsapp-engine ./

# Build the TypeScript files to /dist
RUN npm run build

# Listen port for QR Web API
EXPOSE 3006

# Start the polling engine
CMD ["npm", "start"]
