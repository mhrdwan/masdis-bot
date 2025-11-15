// ============================================
// GROUP CHAT SERVICE
// ============================================
// Handle logic untuk group chat
// - Bot hanya merespons jika DI-TAG/MENTION
// - Memori per user per group (kombinasi group_id + user_number)
// - Limit history yang dikirim ke LLM (5-10 pesan terakhir per user per group)

const db = require("../database");
const config = require("../config");

/**
 * Get atau create group info
 *
 * @param {String} groupId - ID group dari WhatsApp.js
 * @param {String} groupName - Nama group
 * @returns {Object} - Group data
 */
async function getOrCreateGroup(groupId, groupName = null) {
  try {
    // Cek apakah group sudah ada
    const groups = await db.query(
      "SELECT * FROM wa_groups WHERE group_id = ?",
      [groupId]
    );

    if (groups.length > 0) {
      // Update last_active
      await db.query(
        "UPDATE wa_groups SET last_active = NOW() WHERE group_id = ?",
        [groupId]
      );
      return groups[0];
    }

    // Group belum ada, create new
    await db.query(
      "INSERT INTO wa_groups (group_id, group_name, last_active) VALUES (?, ?, NOW())",
      [groupId, groupName]
    );

    console.log(`   📝 New group registered: ${groupName || groupId}`);

    const newGroups = await db.query(
      "SELECT * FROM wa_groups WHERE group_id = ?",
      [groupId]
    );

    return newGroups[0];
  } catch (error) {
    console.error("❌ Error in getOrCreateGroup:", error.message);
    throw error;
  }
}

/**
 * Get atau create user session di group tertentu
 * Setiap user di setiap group punya sesi terpisah
 *
 * @param {String} groupId - ID group
 * @param {String} userNumber - Nomor WhatsApp user
 * @returns {Object} - User session data
 */
async function getOrCreateGroupUserSession(groupId, userNumber) {
  try {
    // Cek apakah sesi sudah ada
    const sessions = await db.query(
      "SELECT * FROM wa_group_user_sessions WHERE group_id = ? AND user_number = ?",
      [groupId, userNumber]
    );

    if (sessions.length > 0) {
      // Update last_interaction
      await db.query(
        "UPDATE wa_group_user_sessions SET last_interaction = NOW() WHERE group_id = ? AND user_number = ?",
        [groupId, userNumber]
      );
      return sessions[0];
    }

    // Sesi belum ada, create new
    await db.query(
      "INSERT INTO wa_group_user_sessions (group_id, user_number, last_interaction) VALUES (?, ?, NOW())",
      [groupId, userNumber]
    );

    console.log(`   📝 New group user session: ${userNumber} in ${groupId}`);

    const newSessions = await db.query(
      "SELECT * FROM wa_group_user_sessions WHERE group_id = ? AND user_number = ?",
      [groupId, userNumber]
    );

    return newSessions[0];
  } catch (error) {
    console.error("❌ Error in getOrCreateGroupUserSession:", error.message);
    throw error;
  }
}

/**
 * Simpan pesan ke group chat history
 * Hanya simpan pesan yang relevan: user tag bot + balasan bot
 * TIDAK semua chat group disimpan, hanya yang melibatkan bot
 *
 * @param {String} groupId - ID group
 * @param {String} userNumber - Nomor WhatsApp pengirim
 * @param {String} role - 'user' atau 'assistant'
 * @param {String} message - Isi pesan
 */
async function saveGroupChatHistory(groupId, userNumber, role, message) {
  try {
    await db.query(
      "INSERT INTO group_chat_history (group_id, user_number, role, message) VALUES (?, ?, ?, ?)",
      [groupId, userNumber, role, message]
    );
    console.log(
      `   💾 Group chat saved: ${role} - ${message.substring(0, 30)}...`
    );
  } catch (error) {
    console.error("❌ Error in saveGroupChatHistory:", error.message);
    throw error;
  }
}

/**
 * Get group chat history terbatas untuk user tertentu di group tertentu
 *
 * PENTING:
 * - Hanya ambil history untuk kombinasi group_id + user_number
 * - Ambil N pesan terakhir (sesuai CHAT_HISTORY_LIMIT)
 * - Ini memastikan setiap user di group punya konteks terpisah
 * - TIDAK mengirim seluruh isi chat grup ke LLM
 * - Hanya history interaksi user tersebut dengan bot di group ini
 *
 * @param {String} groupId - ID group
 * @param {String} userNumber - Nomor WhatsApp user
 * @param {Number} limit - Jumlah pesan yang diambil
 * @returns {Array} - Array of {role, message}
 */
async function getGroupChatHistory(groupId, userNumber, limit = null) {
  try {
    const historyLimit = limit || config.bot.chatHistoryLimit;

    // Ambil N pesan terakhir untuk user ini di group ini
    // Urut dari paling lama ke terbaru untuk dikirim ke LLM
    // Note: LIMIT harus hardcoded, tidak bisa pakai placeholder
    const history = await db.query(
      `SELECT role, message, created_at 
       FROM group_chat_history 
       WHERE group_id = ? AND user_number = ? 
       ORDER BY created_at DESC 
       LIMIT ${parseInt(historyLimit)}`,
      [groupId, userNumber]
    );

    // Reverse agar urutan dari lama ke baru
    return history.reverse();
  } catch (error) {
    console.error("❌ Error in getGroupChatHistory:", error.message);
    throw error;
  }
}

/**
 * Update context untuk user session di group
 * Ini optional, bisa digunakan untuk menyimpan ringkasan konteks
 *
 * @param {String} groupId - ID group
 * @param {String} userNumber - Nomor WhatsApp user
 * @param {String} context - Ringkasan konteks
 */
async function updateGroupUserContext(groupId, userNumber, context) {
  try {
    await db.query(
      "UPDATE wa_group_user_sessions SET context = ? WHERE group_id = ? AND user_number = ?",
      [context, groupId, userNumber]
    );
    console.log(
      `   📋 Group user context updated: ${userNumber} in ${groupId}`
    );
  } catch (error) {
    console.error("❌ Error in updateGroupUserContext:", error.message);
    throw error;
  }
}

/**
 * Cek apakah bot di-mention/tag dalam pesan
 *
 * @param {Object} message - WhatsApp message object
 * @param {Object} client - WhatsApp client
 * @returns {Boolean} - True jika bot di-mention
 */
async function isBotMentioned(message, client) {
  try {
    // Opsi 1: Cek apakah ada mention (paling akurat)
    if (message.mentionedIds && message.mentionedIds.length > 0) {
      const botNumber = client.info.wid._serialized;
      return message.mentionedIds.includes(botNumber);
    }

    // Opsi 2: Cek dengan pattern (fallback jika mention tidak terdeteksi)
    // Misalnya cek apakah ada "@bot" atau keyword tertentu
    const bodyLower = message.body.toLowerCase();
    if (bodyLower.includes("@bot") || bodyLower.includes("@assistant")) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("❌ Error in isBotMentioned:", error.message);
    return false;
  }
}

module.exports = {
  getOrCreateGroup,
  getOrCreateGroupUserSession,
  saveGroupChatHistory,
  getGroupChatHistory,
  updateGroupUserContext,
  isBotMentioned,
};
