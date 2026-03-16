.PHONY: help dev build preview check clean sdk-build

# Default target
help:
	@echo "Miri Dashboard Management Commands:"
	@echo "  make dev         - Start development server"
	@echo "  make build       - Build the dashboard for production"
	@echo "  make preview     - Preview the production build"
	@echo "  make check       - Run Svelte check (TypeScript & Svelte validation)"
	@echo "  make sdk-link    - Print SDK linking instructions (@alexrockshouts/miri-sdk)"
	@echo "  make clean       - Remove build artifacts and node_modules/.vite"

# Development
dev:
	npm run dev

# Production
build:
	npm run build

preview:
	npm run preview

# Quality control
check:
	npm run check

# SDK management
sdk-build sdk-link:
	@echo "=== Local SDK Linking Workflow ==="
	@echo ""
	@echo "For local development with local SDK changes:"
	@echo "1. cd /Users/mirjamagento/GolandProjects/miri-main/api/sdk/typescript  (adjust path)"
	@echo "   npm install"
	@echo "   npm run build"
	@echo "   npm link"
	@echo ""
	@echo "2. cd /Users/mirjamagento/WebstormProjects/miri-dashboard"
	@echo "   npm link @alexrockshouts/miri-sdk"
	@echo "   npm install"
	@echo ""
	@echo "Changes: Edit SDK → npm run build (SDK) → npm install (dashboard) or restart dev."
	@echo ""
	@echo "Unlink:"
	@echo "   npm unlink @alexrockshouts/miri-sdk"
	@echo "   cd SDK && npm unlink"
	@echo ""
	@echo "For release/CI: Ensure SDK published to npm (^1.0.0), use 'npm ci' / 'npm install'."
	@echo "================================================"

# Maintenance
clean:
	rm -rf .svelte-kit
	rm -rf build
	rm -rf .vercel
	@echo "Cleaned build artifacts."
