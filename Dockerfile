# AlgoTrace backend — Go API + Python/C++ tracers (g++/gdb).
# Build from repo root: docker build -t algotrace-backend .

FROM golang:1.25-bookworm AS build
WORKDIR /src
COPY backend/go.mod ./
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /algotrace-api ./cmd/api

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    python3 \
    python-is-python3 \
    g++ \
    gdb \
  && rm -rf /var/lib/apt/lists/* \
  && gdb --version \
  && g++ --version \
  && python3 --version

WORKDIR /app
COPY --from=build /algotrace-api /app/algotrace-api
COPY tracer /app/tracer

ENV ALGOTRACE_ADDR=:8080
ENV ALGOTRACE_TRACER_DIR=/app/tracer
# Render sets PORT; main prefers PORT when present.
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:' + (__import__('os').environ.get('PORT') or '8080').lstrip(':') + '/healthz')" || exit 1

CMD ["/app/algotrace-api"]
