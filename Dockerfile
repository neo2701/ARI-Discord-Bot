FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Use non-root user for security
RUN useradd -m botuser
USER botuser

# Expose nothing (Discord bots don't need incoming ports)
CMD ["npm", "start"]