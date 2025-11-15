// ============================================
// CONFIG - Konfigurasi Aplikasi
// ============================================
require("dotenv").config();

module.exports = {
  // Database Configuration
  db: {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "wa_bot_user",
    password: process.env.DB_PASSWORD || "wa_bot_pass_123",
    database: process.env.DB_NAME || "wa_bot_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  },

  // Bot Configuration
  bot: {
    // Jumlah pesan history yang dikirim ke LLM sebagai konteks
    // Angka ini bisa disesuaikan:
    // - Lebih kecil (5): hemat token, konteks terbatas
    // - Lebih besar (20): konteks lebih lengkap, token lebih banyak
    chatHistoryLimit: parseInt(process.env.CHAT_HISTORY_LIMIT) || 10,
  },

  // LLM Configuration (OpenAI atau provider lain)
  llm: {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4",
    apiUrl:
      process.env.OPENAI_API_URL ||
      "https://api.openai.com/v1/chat/completions",
    maxTokens: 500,
    temperature: 0.7,
  },
};
