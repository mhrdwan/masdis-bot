#!/bin/bash

# ============================================
# Docker Management Script with Auto-Detection
# ============================================

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║      Masterdiskon WhatsApp Bot - Docker Manager         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ============================================
# Auto-detect Docker Compose command
# ============================================
DOCKER_COMPOSE_CMD=""

# Try 'docker compose' (v2 - newer, tanpa hyphen)
if docker compose version &>/dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
    COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "v2.x")
    echo "✅ Docker Compose detected: v2 (docker compose)"
# Try 'docker-compose' (v1 - older, dengan hyphen)
elif docker-compose --version &>/dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
    COMPOSE_VERSION=$(docker-compose version --short 2>/dev/null || echo "v1.x")
    echo "✅ Docker Compose detected: v1 (docker-compose)"
else
    echo "❌ Docker Compose tidak ditemukan!"
    echo ""
    echo "   Silakan install Docker Compose terlebih dahulu:"
    echo "   https://docs.docker.com/compose/install/"
    echo ""
    exit 1
fi

echo "   Version: $COMPOSE_VERSION"
echo ""

# Check if Docker daemon is running
if ! docker info &>/dev/null; then
    echo "❌ Docker daemon tidak berjalan!"
    echo ""
    echo "   Silakan start Docker Desktop atau Docker daemon"
    echo ""
    exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  File .env tidak ditemukan!"
    echo "   Silakan copy .env.example ke .env dan isi GEMINI_API_KEY"
    echo ""
    echo "   cp .env.example .env"
    echo "   nano .env  # atau editor lain"
    echo ""
    exit 1
fi

# Check if GEMINI_API_KEY is set
if ! grep -q "GEMINI_API_KEY=AIza" .env; then
    echo "⚠️  GEMINI_API_KEY belum diisi di .env"
    echo "   Silakan isi GEMINI_API_KEY terlebih dahulu"
    echo ""
    echo "   nano .env  # atau editor lain"
    echo ""
    exit 1
fi

case "$1" in
    start)
        echo "🚀 Starting all services..."
        $DOCKER_COMPOSE_CMD up -d
        echo ""
        echo "✅ Services started!"
        echo ""
        echo "📱 Scan QR code WhatsApp dengan command:"
        echo "   $DOCKER_COMPOSE_CMD logs -f whatsapp-bot"
        echo ""
        echo "🌐 API Server: http://localhost:3000"
        echo "💾 MySQL: localhost:3307 (host) → 3306 (container)"
        echo ""
        echo "📋 Lihat logs: ./docker-manager.sh logs"
        ;;
    
    stop)
        echo "⏹️  Stopping all services..."
        $DOCKER_COMPOSE_CMD down
        echo "✅ Services stopped!"
        ;;
    
    restart)
        echo "🔄 Restarting all services..."
        $DOCKER_COMPOSE_CMD restart
        echo "✅ Services restarted!"
        ;;
    
    logs)
        if [ -z "$2" ]; then
            echo "📋 Showing logs for all services (press Ctrl+C to exit)..."
            $DOCKER_COMPOSE_CMD logs -f
        else
            echo "📋 Showing logs for $2 (press Ctrl+C to exit)..."
            $DOCKER_COMPOSE_CMD logs -f "$2"
        fi
        ;;
    
    build)
        echo "🔨 Building Docker images..."
        $DOCKER_COMPOSE_CMD build --no-cache
        echo "✅ Build complete!"
        ;;
    
    reset)
        echo "⚠️  This will DELETE all data (database, WhatsApp session)!"
        read -p "   Are you sure? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            echo "🗑️  Removing all services and volumes..."
            $DOCKER_COMPOSE_CMD down -v
            echo "✅ Reset complete!"
        else
            echo "❌ Reset cancelled"
        fi
        ;;
    
    status)
        echo "📊 Services status:"
        $DOCKER_COMPOSE_CMD ps
        echo ""
        echo "📦 Volumes:"
        docker volume ls | grep "$(basename $(pwd))" || echo "   No volumes found"
        ;;
    
    qr)
        echo "📱 WhatsApp QR Code (press Ctrl+C to exit):"
        echo ""
        $DOCKER_COMPOSE_CMD logs -f whatsapp-bot
        ;;
    
    *)
        echo "Usage: $0 {start|stop|restart|logs|build|reset|status|qr}"
        echo ""
        echo "Commands:"
        echo "  start   - Start all services (MySQL + WhatsApp Bot + API)"
        echo "  stop    - Stop all services"
        echo "  restart - Restart all services"
        echo "  logs    - Show logs (all or specific: logs whatsapp-bot)"
        echo "  build   - Rebuild Docker images"
        echo "  reset   - Stop and remove all data (DESTRUCTIVE!)"
        echo "  status  - Show services status"
        echo "  qr      - Show WhatsApp QR code"
        echo ""
        exit 1
        ;;
esac
