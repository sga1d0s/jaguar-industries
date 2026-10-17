FROM node:24-bookworm-slim
ARG BUILD_REVISION=local
LABEL org.opencontainers.image.revision=$BUILD_REVISION
ENV BUILD_REVISION=$BUILD_REVISION
ENV NODE_ENV=production PORT=3000 DOCUMENTS_ROOT=/app/product-documents
WORKDIR /app
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --chown=node:node apps/api/*.mjs ./
COPY --chown=node:node apps/api/scripts ./scripts
# Solo PDF de referencia: el acceso HTTP siempre pasa por la autorización de la API.
COPY --chown=node:node docs/referencias/productos ./product-documents
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
