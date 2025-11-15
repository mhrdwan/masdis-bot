#!/bin/bash

# ============================================
# QUICK SETUP SCRIPT - WhatsApp Bot
# ============================================
# Script ini akan membantu setup project dengan cepat

echo "🚀 WhatsApp Bot - Quick Setup"
echo "================================"
echo ""

# Check if Docker is running
echo "📦 Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker tidak berjalan!"
    echo "   Silakan buka Docker Desktop terlebih dahulu."
    exit 1
fi
echo "✅ Docker is running"
echo ""

# Check Node.js
echo "📦 Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js tidak terinstall!"
    echo "   Install Node.js dari: https://nodejs.org/"
    exit 1
fi
NODE_VERSION=$(node -v)
echo "✅ Node.js installed: $NODE_VERSION"
echo ""

# Install dependencies
echo "📥 Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ npm install gagal!"
    exit 1
fi
echo "✅ Dependencies installed"
echo ""

# Start MySQL container
echo "🐳 Starting MySQL container..."
docker-compose up -d
if [ $? -ne 0 ]; then
    echo "❌ Docker compose gagal!"
    exit 1
fi
echo "✅ MySQL container started"
echo ""

# Wait for MySQL to be ready
echo "⏳ Waiting for MySQL to be ready..."
sleep 10

# Test database connection
echo "🔌 Testing database connection..."
docker exec wa_bot_mysql mysqladmin ping -h localhost -u wa_bot_user -pwa_bot_pass_123 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Database is ready!"
else
    echo "⚠️  Database might not be ready yet. Trying again..."
    sleep 5
    docker exec wa_bot_mysql mysqladmin ping -h localhost -u wa_bot_user -pwa_bot_pass_123 > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Database is ready!"
    else
        echo "❌ Database connection failed. Check logs: docker-compose logs mysql"
        exit 1
    fi
fi
echo ""

# Verify tables created
echo "📋 Verifying database tables..."
TABLES=$(docker exec wa_bot_mysql mysql -u wa_bot_user -pwa_bot_pass_123 -D wa_bot_db -e "SHOW TABLES;" 2>/dev/null | grep -v Tables_in)
if [ -n "$TABLES" ]; then
    echo "✅ Database tables created:"
    echo "$TABLES" | sed 's/^/   - /'
else
    echo "⚠️  Tables not found. Check init.sql"
fi
echo ""

# Summary
echo "================================"
echo "✅ Setup Complete!"
echo "================================"
echo ""
echo "📝 Next steps:"
echo "   1. Review .env file (optional: add OPENAI_API_KEY)"
echo "   2. Run: npm start"
echo "   3. Scan QR code dengan WhatsApp"
echo "   4. Test bot dengan kirim pesan!"
echo ""
echo "📚 Documentation:"
echo "   - README.md       → Quick start & usage"
echo "   - ARSITEKTUR.md   → Memory architecture"
echo "   - TESTING.md      → Testing & debugging"
echo ""
echo "🛠️  Useful commands:"
echo "   - docker-compose logs -f mysql   → View MySQL logs"
echo "   - docker-compose ps              → Check container status"
echo "   - docker-compose down            → Stop containers"
echo "   - node index.js                  → Start bot"
echo ""
echo "Happy coding! 🚀"
