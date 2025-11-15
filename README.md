# Masterdiskon WhatsApp Bot

WhatsApp Bot dengan AI (Gemini) + REST API + Hotel Booking Integration

## 🚀 Deploy ke Server - Step by Step

### 1. Upload Project ke Server

```bash
# Di server (via SSH):
cd /var/www  # atau directory lain sesuai keinginan
git clone <repo-url>
cd masdis-bot-wa
```

### 2. Setup Environment

```bash
# Copy .env.example ke .env
cp .env.example .env

# Edit dan isi GEMINI_API_KEY
nano .env
```

**Yang WAJIB diisi di .env:**

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Start Semua Services (1 COMMAND!)

```bash
# Otomatis detect Docker Compose version (v1 atau v2)
./docker-manager.sh start
```

### 4. Scan QR WhatsApp

```bash
# Lihat QR code
./docker-manager.sh qr

# Scan dengan WhatsApp di HP → Done! ✅
```

---

## 📦 Services & Ports

| Service      | Port | Deskripsi                                      |
| ------------ | ---- | ---------------------------------------------- |
| WhatsApp Bot | -    | Bot WhatsApp dengan AI                         |
| REST API     | 3001 | API untuk web/mobile (host) → 3000 (container) |
| MySQL        | 3307 | Database (host) → 3306 (container)             |

**Ports aman dari bentrok!**

---

## 🛠️ Management Commands

```bash
./docker-manager.sh start     # Start semua
./docker-manager.sh stop      # Stop semua
./docker-manager.sh restart   # Restart semua
./docker-manager.sh logs      # Lihat logs
./docker-manager.sh qr        # Lihat QR WhatsApp
./docker-manager.sh status    # Status services
```

---

## 🌐 REST API Test

```bash
# Health check
curl http://localhost:3001/api/health

# Send chat
curl -X POST http://localhost:3001/api/chat/send \
  -H "Content-Type: application/json" \
  -d '{"email":"test@mail.com","name":"Test","message":"Halo"}'

# Get history
curl "http://localhost:3001/api/chat/history?email=test@mail.com"

# Reset conversation (clear hotel booking state)
curl -X POST http://localhost:3001/api/chat/reset \
  -H "Content-Type: application/json" \
  -d '{"email":"test@mail.com"}'

# Hotel booking
curl -X POST http://localhost:3001/api/chat/send \
  -H "Content-Type: application/json" \
  -d '{"email":"test@mail.com","message":"Saya mau cari hotel di Bali"}'
```

---

## ✨ Features

- ✅ AI Chat dengan Google Gemini
- ✅ Multi-step Hotel Booking (7 steps)
- ✅ Auto-detect cancel keywords ("batal", "cancel", "reset", "stop")
- ✅ Auto-clear state on general questions ("kamu siapa?", "apa itu?", etc)
- ✅ Masterdiskon API Integration
- ✅ REST API untuk Web/Mobile
- ✅ HTML & WhatsApp Format Response
- ✅ MySQL Database (port custom)
- ✅ Docker Containerized
- ✅ Auto-restart on crash
- ✅ WhatsApp session persisted

---

## 🆘 Troubleshooting

```bash
# Lihat logs
./docker-manager.sh logs

# Restart jika stuck
./docker-manager.sh restart

# Reset semua data (DESTRUCTIVE!)
./docker-manager.sh reset
```

---

**Deploy Time: ~2 menit** ⚡
