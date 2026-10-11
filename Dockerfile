FROM node:24.11.0-trixie AS client-builder
WORKDIR /app/client
RUN corepack enable
COPY client/package.json client/pnpm-lock.yaml client/pnpm-workspace.yaml ./
RUN pnpm install
COPY client/ ./
RUN pnpm build

FROM golang:1.27-alpine AS server-builder
WORKDIR /app
ARG TARGETOS=linux
ARG TARGETARCH
RUN echo "Building for $TARGETARCH"

COPY go.mod go.sum ./
RUN go mod download

COPY . .
COPY --from=client-builder /app/client/dist ./client/dist

RUN GOOS=$TARGETOS GOARCH=$TARGETARCH CGO_ENABLED=0 go build -ldflags "-s -w" -o bin/server main.go

FROM alpine:3.22.2
RUN apk --no-cache add ca-certificates \
    && addgroup -S heynats && adduser -S -G heynats heynats
WORKDIR /app

COPY --from=server-builder /app/bin/server .

USER heynats

EXPOSE 5000

CMD ["./server"]