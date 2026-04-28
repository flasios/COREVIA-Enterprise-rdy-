.PHONY: dev build test lint format check clean db-push db-migrate db-generate deploy-staging help

NODE_LOCAL_BIN := $(HOME)/.local/node-v20.19.0-darwin-arm64/bin
NPM := $(shell if command -v npm >/dev/null 2>&1; then command -v npm; elif [ -x "$(NODE_LOCAL_BIN)/npm" ]; then echo "$(NODE_LOCAL_BIN)/npm"; else echo npm; fi)
NPX := $(shell if command -v npx >/dev/null 2>&1; then command -v npx; elif [ -x "$(NODE_LOCAL_BIN)/npx" ]; then echo "$(NODE_LOCAL_BIN)/npx"; else echo npx; fi)

# ──────────────────────────────────────────────────────────────────────
# COREVIA Platform – Makefile
# ──────────────────────────────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Development ──────────────────────────────────────────────────────

dev: ## Start development server with HMR
	$(NPM) run dev

install: ## Install dependencies
	$(NPM) ci

clean: ## Remove build artifacts and caches
	rm -rf dist node_modules/.cache .vite
	@echo "✓ Cleaned build artifacts"

# ── Quality ──────────────────────────────────────────────────────────

lint: ## Run ESLint
	$(NPX) eslint . --max-warnings 0

format: ## Format code with Prettier
	$(NPX) prettier --write "apps/web/**/*.{ts,tsx}" "apps/api/**/*.{ts,tsx}" "packages/**/*.{ts,tsx}" "brain/**/*.{ts,tsx}" "domains/**/*.{ts,tsx}" "platform/**/*.{ts,tsx}" "interfaces/**/*.{ts,tsx}" "infrastructure/scripts/**/*.{ts,tsx,mjs,js}"

format-check: ## Check code formatting
	$(NPX) prettier --check "apps/web/**/*.{ts,tsx}" "apps/api/**/*.{ts,tsx}" "packages/**/*.{ts,tsx}" "brain/**/*.{ts,tsx}" "domains/**/*.{ts,tsx}" "platform/**/*.{ts,tsx}" "interfaces/**/*.{ts,tsx}" "infrastructure/scripts/**/*.{ts,tsx,mjs,js}"

check: ## TypeScript type-check (no emit)
	$(NPX) tsc --noEmit

boundary: ## Run architecture boundary checks
	$(NPX) tsx infrastructure/scripts/check-architecture-boundary.ts
	$(NPX) tsx infrastructure/scripts/check-corevia-ai-boundary.ts
	$(NPX) tsx infrastructure/scripts/check-platform-ai-boundary.ts

quality: lint check boundary ## Run all quality checks (lint + typecheck + boundary)

# ── Testing ──────────────────────────────────────────────────────────

test: ## Run server tests
	$(NPX) vitest run --config vitest.server.config.ts

test-watch: ## Run tests in watch mode
	$(NPX) vitest --config vitest.server.config.ts

test-coverage: ## Run tests with coverage report
	$(NPX) vitest run --config vitest.server.config.ts --coverage

test-client: ## Run client-side tests
	$(NPX) vitest run --config vitest.client.config.ts

test-all: test test-client ## Run all test suites

# ── Build ────────────────────────────────────────────────────────────

build: ## Build for production
	$(NPM) run build

docker-build: ## Build Docker image
	docker build -f infrastructure/docker/api.Dockerfile -t corevia-api:latest .

docker-up: ## Start services with Docker Compose
	bash infrastructure/scripts/docker-compose.sh up -d api database cache

docker-down: ## Stop Docker Compose services
	bash infrastructure/scripts/docker-compose.sh down

# ── Database ─────────────────────────────────────────────────────────

db-push: ## Push schema to database (dev)
	$(NPX) drizzle-kit push

db-generate: ## Generate migration from schema changes
	$(NPX) drizzle-kit generate

db-migrate: ## Run pending migrations
	$(NPX) drizzle-kit migrate

db-studio: ## Open Drizzle Studio (database GUI)
	$(NPX) drizzle-kit studio

# ── Deployment (K8s/Helm) ─────────────────────────────────────────────

deploy-staging: ## Deploy to staging via Helm
	helm upgrade --install corevia infrastructure/charts/corevia \
		-f infrastructure/charts/corevia/values-staging.yaml \
		--namespace corevia-staging --create-namespace

deploy-production: ## Deploy to production via Helm (requires confirmation)
	@echo "⚠️  Deploying to PRODUCTION. Press Ctrl+C to abort."
	@read -p "Type 'yes' to confirm: " confirm && [ "$$confirm" = "yes" ] || exit 1
	helm upgrade --install corevia infrastructure/charts/corevia \
		-f infrastructure/charts/corevia/values-production.yaml \
		--namespace corevia-production

# ── Deployment (Azure) ──────────────────────────────────────────────

azure-infra-staging: ## Provision Azure staging infrastructure
	bash infrastructure/scripts/azure-infra-setup.sh staging

azure-infra-production: ## Provision Azure production infrastructure
	bash infrastructure/scripts/azure-infra-setup.sh production

azure-deploy-staging: ## Deploy to Azure staging
	bash infrastructure/scripts/deploy-azure.sh staging

azure-deploy-production: ## Deploy to Azure production (requires confirmation)
	@echo "⚠️  Deploying to Azure PRODUCTION. Press Ctrl+C to abort."
	@read -p "Type 'yes' to confirm: " confirm && [ "$$confirm" = "yes" ] || exit 1
	bash infrastructure/scripts/deploy-azure.sh production

# ── Documentation ────────────────────────────────────────────────────

docs: ## Generate API documentation
	$(NPM) run docs:api

# ── Utilities ────────────────────────────────────────────────────────

create-admin: ## Create a super admin user
	node --import tsx infrastructure/scripts/create-super-admin.ts

health: ## Check application health
	@curl -sf http://localhost:5000/api/health | jq . || echo "❌ Server not responding"
