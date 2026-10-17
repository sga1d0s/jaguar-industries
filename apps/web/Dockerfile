# Servidor sin privilegios; los archivos del panel no requieren Node en producción.
FROM nginxinc/nginx-unprivileged:stable-alpine
ARG BUILD_REVISION=local
LABEL org.opencontainers.image.revision=$BUILD_REVISION
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --chown=101:101 public/ /usr/share/nginx/html/
# Se escribe sobre el archivo incluido, propiedad del usuario sin privilegios.
RUN printf '{"revision":"%s"}\n' "$BUILD_REVISION" > /usr/share/nginx/html/version.json
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
