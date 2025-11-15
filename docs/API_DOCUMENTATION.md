# REST API Documentation - Masterdiskon Chat

REST API untuk integrasi Web & Mobile dengan Masterdiskon Chat Bot.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Semua endpoint (kecuali `/health` dan `/user/register`) memerlukan API Key di header:

```
X-API-Key: your_api_key_here
```

---

## Endpoints

### 1. Health Check

Check status API server.

**GET** `/api/health`

**Headers:** None required

**Response:**

```json
{
  "success": true,
  "message": "Masterdiskon Chat API is running",
  "timestamp": "2025-11-15T10:30:00.000Z"
}
```

---

### 2. Send Chat Message

Kirim pesan dan dapatkan response dari AI bot.

**POST** `/api/chat/send`

**Headers:**

```
Content-Type: application/json
X-API-Key: your_api_key_here
```

**Request Body:**

```json
{
  "message": "Halo, saya ingin booking hotel di Bali"
}
```

**Response Success (200):**

```json
{
  "success": true,
  "data": {
    "user_message": "Halo, saya ingin booking hotel di Bali",
    "bot_response": "Halo! Saya akan membantu Anda mencari hotel di Bali...",
    "timestamp": "2025-11-15T10:30:00.000Z"
  }
}
```

**Response Error (400):**

```json
{
  "success": false,
  "error": "Message is required and must be a non-empty string"
}
```

**Response Error (401):**

```json
{
  "success": false,
  "error": "Invalid or inactive API key"
}
```

---

### 3. Get Chat History

Ambil riwayat chat (default 10 pesan terakhir).

**GET** `/api/chat/history?limit=10`

**Headers:**

```
X-API-Key: your_api_key_here
```

**Query Parameters:**

- `limit` (optional): Jumlah pesan yang diambil (default: 10, max: 50)

**Response Success (200):**

```json
{
  "success": true,
  "data": {
    "history": [
      {
        "role": "user",
        "message": "Halo",
        "created_at": "2025-11-15T10:29:00.000Z"
      },
      {
        "role": "assistant",
        "message": "Halo! Ada yang bisa saya bantu?",
        "created_at": "2025-11-15T10:29:01.000Z"
      },
      {
        "role": "user",
        "message": "Saya ingin booking hotel",
        "created_at": "2025-11-15T10:30:00.000Z"
      }
    ],
    "total": 3
  }
}
```

---

### 4. Register User (Admin Only)

Register user baru dan generate API key.

**POST** `/api/user/register`

**Headers:**

```
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "full_name": "John Doe"
}
```

**Response Success (201):**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "full_name": "John Doe",
    "api_key": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890123456789012"
  },
  "message": "User registered successfully. Please save your API key securely."
}
```

**Response Error (409 - Already Exists):**

```json
{
  "success": false,
  "error": "User with this email already exists",
  "data": {
    "email": "user@example.com",
    "api_key": "existing_api_key..."
  }
}
```

---

## Usage Examples

### cURL

**Send Message:**

```bash
curl -X POST http://localhost:3000/api/chat/send \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key_here" \
  -d '{"message": "Halo, saya ingin booking hotel"}'
```

**Get History:**

```bash
curl http://localhost:3000/api/chat/history?limit=10 \
  -H "X-API-Key: your_api_key_here"
```

**Register User:**

```bash
curl -X POST http://localhost:3000/api/user/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "full_name": "Test User"}'
```

### JavaScript (Fetch)

```javascript
// Send message
const sendMessage = async (message) => {
  const response = await fetch("http://localhost:3000/api/chat/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": "your_api_key_here",
    },
    body: JSON.stringify({ message }),
  });

  const data = await response.json();
  return data;
};

// Get history
const getHistory = async (limit = 10) => {
  const response = await fetch(
    `http://localhost:3000/api/chat/history?limit=${limit}`,
    {
      headers: {
        "X-API-Key": "your_api_key_here",
      },
    }
  );

  const data = await response.json();
  return data;
};
```

### Python (requests)

```python
import requests

API_URL = "http://localhost:3000/api"
API_KEY = "your_api_key_here"

# Send message
def send_message(message):
    response = requests.post(
        f"{API_URL}/chat/send",
        headers={
            "Content-Type": "application/json",
            "X-API-Key": API_KEY
        },
        json={"message": message}
    )
    return response.json()

# Get history
def get_history(limit=10):
    response = requests.get(
        f"{API_URL}/chat/history",
        headers={"X-API-Key": API_KEY},
        params={"limit": limit}
    )
    return response.json()
```

---

## Error Codes

- `400`: Bad Request - Invalid input
- `401`: Unauthorized - Missing or invalid API key
- `404`: Not Found - Endpoint tidak ditemukan
- `409`: Conflict - Resource already exists (untuk register)
- `500`: Internal Server Error

---

## Database Schema

### Table: `web_users`

```sql
id          INT PRIMARY KEY AUTO_INCREMENT
email       VARCHAR(255) UNIQUE NOT NULL
full_name   VARCHAR(255) NOT NULL
api_key     VARCHAR(64) UNIQUE NOT NULL
is_active   BOOLEAN DEFAULT TRUE
created_at  TIMESTAMP
last_login  TIMESTAMP
```

### Table: `web_chat_history`

```sql
id          INT PRIMARY KEY AUTO_INCREMENT
user_id     INT FOREIGN KEY -> web_users(id)
role        ENUM('user', 'assistant')
message     TEXT NOT NULL
created_at  TIMESTAMP
```

---

## Running the API

### Option 1: Combined (WhatsApp Bot + API)

```bash
npm start
# API running on port 3000
# WhatsApp bot also running
```

### Option 2: API Only

```bash
node start-api.js
# Only API server, no WhatsApp bot
```

### Option 3: Disable API

```bash
# Set in .env
ENABLE_API_SERVER=false

npm start
# Only WhatsApp bot, no API server
```

---

## Notes

- API Key disimpan secara plain text di database (untuk production, gunakan hashing)
- Chat history dibatasi 10 pesan untuk hemat memori
- Setiap user punya history terpisah
- API ini berbeda dengan WhatsApp chat (table terpisah)
