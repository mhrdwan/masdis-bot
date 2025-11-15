// ============================================
// WEB CHAT SERVICE
// ============================================
// Service untuk handle chat dari web/mobile app

const db = require("../database");
const config = require("../config");

/**
 * Get atau create web user berdasarkan email
 */
async function getOrCreateWebUser(email, name = null) {
  try {
    // Cek apakah user sudah ada
    const rows = await db.query("SELECT * FROM web_users WHERE email = ?", [
      email,
    ]);

    if (rows.length > 0) {
      // Update last_interaction
      await db.query(
        "UPDATE web_users SET last_interaction = NOW() WHERE email = ?",
        [email]
      );
      return rows[0];
    }

    // Buat user baru
    await db.query(
      "INSERT INTO web_users (email, name, last_interaction) VALUES (?, ?, NOW())",
      [email, name]
    );

    const newRows = await db.query("SELECT * FROM web_users WHERE email = ?", [
      email,
    ]);

    console.log(`   📝 New web user created: ${email}`);
    return newRows[0];
  } catch (error) {
    console.error("Error in getOrCreateWebUser:", error.message);
    throw error;
  }
}

/**
 * Simpan chat history untuk web user
 */
async function saveWebChatHistory(email, role, message) {
  try {
    await db.query(
      "INSERT INTO web_chat_history (email, role, message, created_at) VALUES (?, ?, ?, NOW())",
      [email, role, message]
    );
    console.log(`   💾 Chat saved: ${role} - ${message.substring(0, 50)}...`);
  } catch (error) {
    console.error("Error in saveWebChatHistory:", error.message);
    throw error;
  }
}

/**
 * Ambil chat history terbatas untuk web user (untuk dikirim ke LLM)
 */
async function getWebChatHistory(email, limit = null) {
  try {
    const historyLimit = limit || config.bot.chatHistoryLimit;

    // Ambil N pesan terakhir, diurutkan dari yang paling lama
    const query = `
      SELECT role, message, created_at
      FROM web_chat_history
      WHERE email = ?
      ORDER BY created_at DESC
      LIMIT ${parseInt(historyLimit)}
    `;

    const rows = await db.query(query, [email]);

    // Reverse agar urutan dari lama ke baru (untuk konteks LLM)
    return rows.reverse();
  } catch (error) {
    console.error("Error in getWebChatHistory:", error.message);
    throw error;
  }
}

/**
 * Ambil semua chat history untuk web user (untuk ditampilkan di UI)
 * Limit default 50 pesan terakhir
 */
async function getAllWebChatHistory(email, limit = 50) {
  try {
    // Sanitize limit to prevent SQL injection
    const safeLimit = parseInt(limit) || 50;

    const query = `
      SELECT role, message, created_at
      FROM web_chat_history
      WHERE email = ?
      ORDER BY created_at DESC
      LIMIT ${safeLimit}
    `;

    const rows = await db.query(query, [email]);

    // Reverse agar urutan dari lama ke baru
    return rows.reverse();
  } catch (error) {
    console.error("Error in getAllWebChatHistory:", error.message);
    throw error;
  }
}

module.exports = {
  getOrCreateWebUser,
  saveWebChatHistory,
  getWebChatHistory,
  getAllWebChatHistory,
};
