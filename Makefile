.PHONY: help install install-frontend dev dev-frontend build build-frontend lint lint-frontend test typecheck db-migrate db-rollback db-generate db-seed clean flush redis-shell postgres-psql docker-up docker-up-dev docker-down docker-logs setup

APP_DIR := .
FRONTEND_DIR := frontend

help:
	@echo "Email Gateway — Makefile targets"
	@echo ""
	@echo "Development"
	@echo "  make install              Install Python deps (uv sync --frozen)"
	@echo "  make install-frontend     Install frontend deps (bun install --frozen-lockfile)"
	@echo "  make dev                  Start api + worker hot-reload (uvicorn)"
	@echo "  make dev-frontend         Start frontend dev server (bun run dev)"
	@echo ""
	@echo "Build"
	@echo "  make build                Build api Docker image"
	@echo "  make build-frontend       Build frontend Docker image"
	@echo "  make build-prod           Build production images tanpa cache (api + frontend)"
	@echo "  make docker-up            Start full stack via docker-compose"
	@echo "  make docker-up-dev        Start full stack with development profile (includes pgadmin)"
	@echo "  make docker-down          Stop full stack and remove containers"
	@echo "  make docker-logs          Stream docker-compose logs"
	@echo ""
	@echo "Quality"
	@echo "  make lint                 Run ruff on app + worker"
	@echo "  make lint-frontend        Run oxlint on frontend"
	@echo "  make typecheck            Run mypy on app + worker"
	@echo "  make test                 Run pytest (with .env if present)"
	@echo ""
	@echo "Database"
	@echo "  make db-migrate           Run alembic upgrade head"
	@echo "  make db-rollback          Run alembic downgrade -1"
	@echo "  make db-generate          Run alembic revision --autogenerate (read heads)"
	@echo "  make db-seed              Seed API key into database"
	@echo "  make db-shell             Open psql for postgres service"
	@echo "  make redis-shell          Open redis-cli for redis service"
	@echo ""
	@echo "Utilities"
	@echo "  make clean                Remove Python caches + .venv + build artifacts"
	@echo "  make flush                Clear ruff/mypy/pytest caches"

install:
	cd $(APP_DIR) && uv sync --frozen

install-frontend:
	cd $(FRONTEND_DIR) && bun install --frozen-lockfile

dev:
	cd $(APP_DIR) && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	cd $(FRONTEND_DIR) && bun run dev

build:
	cd $(APP_DIR) && docker build -t email-gateway-api .

build-frontend:
	cd $(FRONTEND_DIR) && docker build -t email-gateway-frontend .

build-prod:
	cd $(APP_DIR) && docker build --no-cache -t email-gateway-api:latest .
	cd $(FRONTEND_DIR) && docker build --no-cache -t email-gateway-frontend:latest .

lint:
	cd $(APP_DIR) && uv run ruff check app worker

lint-frontend:
	cd $(FRONTEND_DIR) && bun run lint

typecheck:
	cd $(APP_DIR) && uv run mypy

test:
ifeq ($(wildcard .env),.env)
	cd $(APP_DIR) && uv run pytest
else
	cd $(APP_DIR) && uv run pytest
endif

db-migrate:
	docker compose run --rm api alembic upgrade head

db-rollback:
	docker compose run --rm api alembic downgrade -1

db-generate:
	docker compose run --rm api alembic revision --autogenerate -m "auto"

db-seed:
	docker compose run --rm api uv run scripts/seed_api_key.py

db-shell:
	docker compose exec postgres psql -U $(POSTGRES_USER:%=%) -d $(POSTGRES_DB:%=%)

redis-shell:
	docker compose exec redis redis-cli

docker-up:
	docker compose up -d --build

docker-up-dev:
	docker compose --profile development up -d --build

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

flush:
	rm -rf .ruff_cache .mypy_cache .pytest_cache
	cd $(APP_DIR) && find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

clean: flush
	rm -rf .venv
	rm -rf $(APP_DIR)/dist $(FRONTEND_DIR)/dist
	cd $(APP_DIR) && find . -type f -name "*.pyc" -delete
	cd $(FRONTEND_DIR) && find . -type f -name "*.tsbuildinfo" -delete
