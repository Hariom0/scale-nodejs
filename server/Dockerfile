FROM node:20-alpine
WORKDIR /app
COPY package*.json .
RUN npm install -g pm2
COPY . .
CMD ["pm2-runtime","start","ecosystem.config.cjs"]