# Use Node.js base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY ./server/package*.json ./server/
COPY ./client/package*.json ./client/

# Install dependencies for server and client
RUN npm install --prefix server
RUN npm install --prefix client

# Install 'serve' globally
RUN npm install -g serve

# Copy the rest of the files
COPY ./server ./server
COPY ./client ./client

# Build the client
RUN npm run build --prefix client

# Expose ports
EXPOSE 8080

# Command to run both server and client
CMD ["sh", "-c", "node server/server.js & serve -s client/dist -l 8080"]
