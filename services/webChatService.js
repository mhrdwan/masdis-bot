// ============================================
// WEB/MOBILE CHAT SERVICE
// ============================================

const db = require("../database");
const config = require("../config");

/**
 * Authenticate user by API key
 * @param {String} apiKey - API key dari header
 * @returns {Object|null} - User object atau null
 */
async function authenticateUser(apiKey) {
  try {
    const [users] = await db.query(
      "SELECT id, email, full_name, is_active FROM web_users WHERE api_key = ? AND is_active = TRUE",
      [apiKey]
    );

    if (users.length === 0) {
      return null;
    }

    // Update last login
    await db.query("UPDATE web_users SET last_login = NOW() WHERE id = ?", [
      users[0].id,
    ]);

    return users[0];
  } catch (error) {
    console.error("❌ Auth error:", error.message);
    return null;
  }
}

/**
 * Get chat history untuk user (10 terakhir)
 * @param {Number} userId - User ID
 * @param {Number} limit - Limit history (default 10)
 * @returns {Array} - Chat history
 */
async function getChatHistory(userId, limit = 10) {
  try {
    const [history] = await db.query(
      `SELECT role, message, created_at 
       FROM web_chat_history 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ${parseInt(limit)}`,
      [userId]
    );

    // Reverse agar urutan dari lama ke baru
    return history.reverse();
  } catch (error) {
    console.error("❌ Get history error:", error.message);
    return [];
  }
}

/**
 * Save chat message
 * @param {Number} userId - User ID
 * @param {String} role - 'user' atau 'assistant'
 * @param {String} message - Message content
 */
async function saveChatMessage(userId, role, message) {
  try {
    await db.query(
      "INSERT INTO web_chat_history (user_id, role, message) VALUES (?, ?, ?)",
      [userId, role, message]
    );
  } catch (error) {
    console.error("❌ Save message error:", error.message);
    throw error;
  }
}

/**
 * Create new user (untuk admin/registration)
 * @param {String} email - Email user
 * @param {String} fullName - Full name
 * @returns {Object} - User dengan API key
 */
async function createUser(email, fullName) {
  try {
    const crypto = require("crypto");
    const apiKey = crypto.randomBytes(32).toString("hex");

    const [result] = await db.query(
      "INSERT INTO web_users (email, full_name, api_key) VALUES (?, ?, ?)",
      [email, fullName, apiKey]
    );

    return {
      id: result.insertId,
      email: email,
      full_name: fullName,
      api_key: apiKey,
    };
  } catch (error) {
    console.error("❌ Create user error:", error.message);
    throw error;
  }
}

/**
 * Get user by email
 */
async function getUserByEmail(email) {
  try {
    const [users] = await db.query(
      "SELECT id, email, full_name, api_key, is_active FROM web_users WHERE email = ?",
      [email]
    );

    return users.length > 0 ? users[0] : null;
  } catch (error) {
    console.error("❌ Get user error:", error.message);
    return null;
  }
}

module.exports = {
  authenticateUser,
  getChatHistory,
  saveChatMessage,
  createUser,
  getUserByEmail,
};
