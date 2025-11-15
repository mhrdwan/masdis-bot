// ============================================
// PRIVATE CHAT SERVICE
// ============================================
// Handle logic untuk private chat (user ↔ bot)
// - Simpan/load profil user
// - Simpan/load chat history
// - Limit history yang dikirim ke LLM (5-10 pesan terakhir)

const db = require("../database");
const config = require("../config");

/**
 * Get atau create user profile
 * Jika user belum ada di database, akan dibuat record baru
 *
 * @param {String} waNumber - Nomor WhatsApp (format: 628xxx@c.us)
 * @param {String} name - Nama user (optional)
 * @returns {Object} - User data
 */
async function getOrCreateUser(waNumber, name = null) {
  try {
    // Cek apakah user sudah ada
    const users = await db.query("SELECT * FROM wa_users WHERE wa_number = ?", [
      waNumber,
    ]);

    if (users.length > 0) {
      // Update last_interaction
      await db.query(
        "UPDATE wa_users SET last_interaction = NOW() WHERE wa_number = ?",
        [waNumber]
      );
      return users[0];
    }

    // User belum ada, create new
    await db.query(
      "INSERT INTO wa_users (wa_number, name, last_interaction) VALUES (?, ?, NOW())",
      [waNumber, name]
    );

    console.log(`   📝 New user created: ${waNumber}`);

    // Return user yang baru dibuat
    const newUsers = await db.query(
      "SELECT * FROM wa_users WHERE wa_number = ?",
      [waNumber]
    );

    return newUsers[0];
  } catch (error) {
    console.error("❌ Error in getOrCreateUser:", error.message);
    throw error;
  }
}

/**
 * Simpan pesan ke chat history
 *
 * @param {String} waNumber - Nomor WhatsApp
 * @param {String} role - 'user' atau 'assistant'
 * @param {String} message - Isi pesan
 */
async function saveChatHistory(waNumber, role, message) {
  try {
    await db.query(
      "INSERT INTO chat_history (wa_number, role, message) VALUES (?, ?, ?)",
      [waNumber, role, message]
    );
    console.log(`   💾 Chat saved: ${role} - ${message.substring(0, 30)}...`);
  } catch (error) {
    console.error("❌ Error in saveChatHistory:", error.message);
    throw error;
  }
}

/**
 * Get chat history terbatas (N pesan terakhir)
 *
 * PENTING:
 * - Hanya ambil beberapa pesan terakhir (sesuai CHAT_HISTORY_LIMIT)
 * - Tujuan: hemat token LLM dan jaga konteks tetap relevan
 * - Semua history tetap tersimpan di DB, tapi yang dikirim ke LLM terbatas
 * - Ini adalah "short-term memory" yang dikirim sebagai FULL TEXT (bukan embedding)
 *
 * @param {String} waNumber - Nomor WhatsApp
 * @param {Number} limit - Jumlah pesan yang diambil (default dari config)
 * @returns {Array} - Array of {role, message}
 */
async function getChatHistory(waNumber, limit = null) {
  try {
    const historyLimit = limit || config.bot.chatHistoryLimit;

    // Ambil N pesan terakhir, urut dari paling lama ke terbaru
    // Ini penting agar konteks dikirim ke LLM dengan urutan yang benar
    // Note: LIMIT harus hardcoded, tidak bisa pakai placeholder
    const history = await db.query(
      `SELECT role, message, created_at 
       FROM chat_history 
       WHERE wa_number = ? 
       ORDER BY created_at DESC 
       LIMIT ${parseInt(historyLimit)}`,
      [waNumber]
    );

    // Reverse agar urutan dari lama ke baru (untuk dikirim ke LLM)
    return history.reverse();
  } catch (error) {
    console.error("❌ Error in getChatHistory:", error.message);
    throw error;
  }
}

/**
 * Update memory summary untuk user
 * Ini optional, bisa digunakan untuk menyimpan ringkasan konteks jangka panjang
 *
 * @param {String} waNumber - Nomor WhatsApp
 * @param {String} summary - Ringkasan memori
 */
async function updateMemorySummary(waNumber, summary) {
  try {
    await db.query(
      "UPDATE wa_users SET memory_summary = ? WHERE wa_number = ?",
      [summary, waNumber]
    );
    console.log(`   📋 Memory summary updated for: ${waNumber}`);
  } catch (error) {
    console.error("❌ Error in updateMemorySummary:", error.message);
    throw error;
  }
}

/**
 * Get semua chat history (untuk generate summary, analytics, dll)
 * Ini TIDAK dikirim ke LLM, hanya untuk keperluan internal
 *
 * @param {String} waNumber - Nomor WhatsApp
 * @returns {Array} - Semua history chat
 */
async function getAllChatHistory(waNumber) {
  try {
    const history = await db.query(
      "SELECT role, message, created_at FROM chat_history WHERE wa_number = ? ORDER BY created_at ASC",
      [waNumber]
    );
    return history;
  } catch (error) {
    console.error("❌ Error in getAllChatHistory:", error.message);
    throw error;
  }
}

module.exports = {
  getOrCreateUser,
  saveChatHistory,
  getChatHistory,
  updateMemorySummary,
  getAllChatHistory,
};
