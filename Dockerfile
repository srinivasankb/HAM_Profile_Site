# Build stage
FROM node:22.13.1-alpine AS build
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM caddy:2-alpine
WORKDIR /usr/share/caddy

# Copy the static build from the previous stage
COPY --from=build /app/dist .

# Add a basic Caddy configuration
RUN printf "localhost:80 {\n\
    root * /usr/share/caddy\n\
    file_server\n\
    encode gzip\n\
    handle_errors {\n\
        rewrite * /404.html\n\
        file_server\n\
    }\n\
}" > /etc/caddy/Caddyfile

EXPOSE 80
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
