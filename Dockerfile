FROM nginx:1.30.5-alpine

# The image receives only the curated presentation, never the engineering folders.
COPY nginx.conf /etc/nginx/nginx.conf
COPY --chown=101:101 public/ /usr/share/nginx/html/

USER 101:101
EXPOSE 8080
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
