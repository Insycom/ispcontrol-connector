FROM node:24-alpine AS build
WORKDIR /app
COPY apps/connector/package.json ./package.json
RUN npm install
COPY apps/connector/tsconfig.json ./tsconfig.json
COPY apps/connector/src ./src
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production
ENV ISPCONTROL_MODULES_ROOT=/docker/ispcontrol
WORKDIR /app
RUN apk add --no-cache docker-cli docker-cli-compose iputils su-exec
RUN addgroup -S ispcontrol && adduser -S ispcontrol -G ispcontrol
RUN mkdir -p /var/lib/ispcontrol && chown ispcontrol:ispcontrol /var/lib/ispcontrol
COPY --from=build --chown=ispcontrol:ispcontrol /app/dist ./dist
COPY apps/connector/entrypoint.sh /entrypoint.sh
RUN chmod 755 /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
VOLUME ["/var/lib/ispcontrol"]
EXPOSE 9080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:9080/health || exit 1
CMD ["node", "dist/main.js"]
