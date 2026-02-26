.PHONY: help dev build preview check clean sdk-build

# Default target
help:
	@echo "Miri Dashboard Management Commands:"
	@echo "  make dev         - Start development server"
	@echo "  make build       - Build the dashboard for production"
	@echo "  make preview     - Preview the production build"
	@echo "  make check       - Run Svelte check (TypeScript & Svelte validation)"
	@echo "  make sdk-build   - Build the local @miri/sdk dependency"
	@echo "  make clean       - Remove build artifacts and node_modules/.vite"

# Development
dev:
	npm run dev

# Production
build: sdk-build
	npm run build

preview:
	npm run preview

# Quality control
check:
	npm run check

# SDK build
sdk-build:
	cd ../../GolandProjects/miri-main/api/sdk/typescript && npm run build

# Maintenance
clean:
	rm -rf .svelte-kit
	rm -rf build
	rm -rf .vercel
	@echo "Cleaned build artifacts."
