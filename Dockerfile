# Use Node.js base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy server package files and install dependencies
COPY ./server/package*.json ./server/
RUN npm install --prefix server

# Copy client package files and install dependencies
COPY ./client/package*.json ./client/
RUN npm install --prefix client

RUN npm install -g serve

# Build the client
COPY ./client ./client
RUN npm run build --prefix client

# Copy server source files
COPY ./server ./server

# Expose ports for server and client
EXPOSE 3000 8080

# Command to run both server and client
CMD ["sh", "-c", "node server/server.js & serve -s client/dist -l 3000"]