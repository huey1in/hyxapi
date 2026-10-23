FROM --platform=$BUILDPLATFORM oven/bun:1@sha256:0733e50325078969732ebe3b15ce4c4be5082f18c4ac1a0f0ca4839c2e4e42a7 AS builder

WORKDIR /build
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile
COPY ./web .
RUN bun run build

FROM --platform=$BUILDPLATFORM golang:1.26.1-alpine@sha256:2389ebfa5b7f43eeafbd6be0c3700cc46690ef842ad962f6c5bd6be49ed82039 AS builder2
ENV GO111MODULE=on CGO_ENABLED=0 GOWORK=off

ARG TARGETOS
ARG TARGETARCH
ARG VERSION
ENV GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64}
ENV GOEXPERIMENT=greenteagc

WORKDIR /build

ADD go.mod go.sum ./
ADD relaykit/go.mod ./relaykit/go.mod
ADD tokenkit/go.mod ./tokenkit/go.mod
RUN go mod download

COPY . .
COPY --from=builder /build/dist ./web/dist
RUN go build -trimpath -ldflags "-s -w -X 'github.com/QuantumNous/new-api/common.Version=${VERSION:-$(cat VERSION)}'" -o hyxapi

FROM debian:bookworm-slim@sha256:f06537653ac770703bc45b4b113475bd402f451e85223f0f2837acbf89ab020a

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata wget \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

COPY --from=builder2 /build/hyxapi /
COPY --from=builder2 /build/LICENSE /build/NOTICE /build/THIRD-PARTY-LICENSES.md /usr/share/doc/hyxapi/
LABEL org.opencontainers.image.title="HyxAPI" \
      org.opencontainers.image.source="https://github.com/huey1in/hyxapi" \
      org.opencontainers.image.licenses="AGPL-3.0"
EXPOSE 3000
WORKDIR /data
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget -q -O - http://127.0.0.1:3000/api/status | grep -Eq '"success"[[:space:]]*:[[:space:]]*true' || exit 1
ENTRYPOINT ["/hyxapi"]
