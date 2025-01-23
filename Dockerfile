# Use Node.js base image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Install server dependencies
COPY ./server/package*.json ./server/
RUN npm install --prefix server --only=production

# Install client dependencies and build the React app
COPY ./client/package*.json ./client/
RUN npm install --prefix client
COPY ./client ./client
RUN npm run build --prefix client

# Copy server source files
COPY ./server ./server

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Start the server
CMD ["node", "server/server.js"]
