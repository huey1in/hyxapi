FRONTEND_DIR = ./web
BACKEND_DIR = .

.PHONY: all build-frontend start-backend

all: build-frontend start-backend

build-frontend:
	@echo "Building frontend..."
	@cd $(FRONTEND_DIR) && bun install --frozen-lockfile && bun run build

start-backend:
	@echo "Starting backend dev server..."
	@cd $(BACKEND_DIR) && go run .
