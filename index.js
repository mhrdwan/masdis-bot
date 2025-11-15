// ============================================
// WHATSAPP BOT - MAIN FILE
// ============================================
// Bot WhatsApp dengan AI/LLM dan MySQL untuk memori chat
// Support: Private chat & Group chat (hanya respons jika di-tag)

const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const db = require("./database");
const config = require("./config");
const llm = require("./llm-gemini"); // Using Google Gemini
const privateChat = require("./services/privateChat");
const groupChat = require("./services/groupChat");

// Start REST API Server (untuk web & mobile)
const { startAPIServer } = require("./api-server");
if (process.env.ENABLE_API_SERVER !== "false") {
  startAPIServer();
}

// ============================================
// INISIALISASI WHATSAPP CLIENT
// ============================================
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: "./.wwebjs_auth", // Folder untuk menyimpan session WhatsApp
  }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-blink-features=AutomationControlled",
      "--user-data-dir=/tmp/chromium-user-data",
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  },
  webVersionCache: {
    type: "remote",
    remotePath:
      "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
  },
  authTimeoutMs: 0,
  qrMaxRetries: 5,
});

// ============================================
// EVENT: QR CODE
// ============================================
// Scan QR code ini dengan WhatsApp di HP untuk login
client.on("qr", (qr) => {
  console.log("\n📱 Scan QR code ini dengan WhatsApp:");
  qrcode.generate(qr, { small: true });
  console.log("\nAtau buka WhatsApp > Linked Devices > Link a Device\n");
});

// ============================================
// EVENT: READY
// ============================================
// Bot siap menerima pesan
client.on("ready", () => {
  console.log("✅ WhatsApp Bot is READY!");
  console.log(`   Bot Number: ${client.info.wid.user}`);
  console.log(`   Bot Name: ${client.info.pushname}`);
  console.log("   Waiting for messages...\n");
});

// ============================================
// EVENT: AUTHENTICATED
// ============================================
client.on("authenticated", () => {
  console.log("✅ WhatsApp authenticated successfully!");
});

// ============================================
// EVENT: AUTH FAILURE
// ============================================
client.on("auth_failure", (msg) => {
  console.error("❌ Authentication failed:", msg);
  console.log("   Hapus folder .wwebjs_auth dan coba lagi.");
});

// ============================================
// EVENT: DISCONNECTED
// ============================================
client.on("disconnected", (reason) => {
  console.log("⚠️  WhatsApp disconnected:", reason);
  console.log("   Bot will try to reconnect...");
});

// ============================================
// EVENT: LOADING SCREEN
// ============================================
client.on("loading_screen", (percent, message) => {
  console.log(`⏳ Loading: ${percent}% - ${message}`);
});

// ============================================
// EVENT: REMOTE SESSION SAVED
// ============================================
client.on("remote_session_saved", () => {
  console.log("✅ Remote session saved successfully");
});

// ============================================
// RATE LIMITING (Anti-spam)
// ============================================
const userLastMessage = new Map();
const COOLDOWN_MS = 2000; // 2 detik cooldown per user

function isRateLimited(userId) {
  const now = Date.now();
  const lastTime = userLastMessage.get(userId) || 0;

  if (now - lastTime < COOLDOWN_MS) {
    return true;
  }

  userLastMessage.set(userId, now);
  return false;
}

// ============================================
// EVENT: MESSAGE (HANDLER UTAMA)
// ============================================
client.on("message", async (message) => {
  try {
    // Abaikan pesan dari bot sendiri
    if (message.fromMe) return;

    // Rate limiting untuk mencegah spam
    if (isRateLimited(message.from)) {
      console.log("⏳ Rate limited, skipping...");
      return;
    }

    // Abaikan pesan media (untuk simplicity, bisa dikembangkan nanti)
    if (message.hasMedia) {
      console.log("📎 Media message received (skipped)");
      return;
    }

    const chat = await message.getChat();
    const contact = await message.getContact();
    const senderNumber = message.from; // Format: 628xxx@c.us atau 628xxx-123456@g.us

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(
      `📨 Message received from: ${contact.pushname || senderNumber}`
    );
    console.log(`   Type: ${chat.isGroup ? "GROUP" : "PRIVATE"}`);
    console.log(`   Message: ${message.body}`);

    // ============================================
    // PRIVATE CHAT HANDLER
    // ============================================
    if (!chat.isGroup) {
      await handlePrivateChat(message, senderNumber, contact);
    }
    // ============================================
    // GROUP CHAT HANDLER
    // ============================================
    else {
      await handleGroupChat(message, chat, senderNumber, contact);
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  } catch (error) {
    console.error("❌ Error handling message:", error.message);
    console.error(error.stack);
  }
});

// ============================================
// HANDLER: PRIVATE CHAT
// ============================================
/**
 * Handle pesan dari private chat (user ↔ bot)
 *
 * FLOW:
 * 1. Get/create user profile
 * 2. Simpan pesan user ke chat_history
 * 3. Ambil beberapa chat terakhir (5-10) sebagai konteks
 * 4. Panggil LLM dengan konteks tersebut
 * 5. Simpan balasan bot ke chat_history
 * 6. Kirim balasan ke user
 */
async function handlePrivateChat(message, senderNumber, contact) {
  try {
    console.log("   🔹 Handling PRIVATE chat...");

    // 1. Get atau create user
    const user = await privateChat.getOrCreateUser(
      senderNumber,
      contact.pushname || contact.name
    );

    // 2. CHECK HOTEL REQUEST FIRST - sebelum save ke database!
    const hotelBooking = require("./services/hotelBooking");
    const conversationState = require("./services/conversationState");

    const isInHotelFlow = conversationState.isInConversation(senderNumber);
    const isHotelReq = hotelBooking.isHotelRequest(message.body);

    console.log(
      `   🔍 Hotel check: inFlow=${isInHotelFlow}, isRequest=${isHotelReq}`
    );

    // Jika ini hotel request atau sedang dalam flow, handle langsung
    if (isInHotelFlow || isHotelReq) {
      console.log("   🏨 Processing hotel booking request...");

      // Save user message untuk hotel context
      await privateChat.saveChatHistory(senderNumber, "user", message.body);

      const hotelResponse = await hotelBooking.handleHotelBooking(
        senderNumber,
        message.body,
        contact.pushname || contact.name
      );

      if (hotelResponse) {
        await privateChat.saveChatHistory(
          senderNumber,
          "assistant",
          hotelResponse
        );
        await message.reply(hotelResponse);
        console.log("   ✅ Hotel booking response sent");
        return;
      }
    }

    // 3. Bukan hotel request, simpan ke database untuk LLM
    await privateChat.saveChatHistory(senderNumber, "user", message.body);

    // 4. Ambil chat history terbatas (5-10 pesan terakhir)
    // PENTING: Hanya pesan terakhir yang dikirim ke LLM untuk hemat token
    const history = await privateChat.getChatHistory(senderNumber);
    console.log(
      `   📚 Loaded ${history.length} chat history (limit: ${config.bot.chatHistoryLimit})`
    );

    // 5. Panggil LLM untuk generate respons
    const botResponse = await llm.callLLM(history, message.body, {
      userName: contact.pushname || contact.name,
      isGroup: false,
    });

    // 6. Simpan balasan bot ke database
    await privateChat.saveChatHistory(senderNumber, "assistant", botResponse);

    // 7. Kirim balasan ke user
    await message.reply(botResponse);
    console.log("   ✅ Reply sent to user");

    // Optional: Update memory summary setiap beberapa pesan
    // Ini bisa dijadwal atau triggered setelah N interaksi
    // const allHistory = await privateChat.getAllChatHistory(senderNumber);
    // if (allHistory.length % 20 === 0) {
    //   const summary = await llm.generateMemorySummary(allHistory);
    //   await privateChat.updateMemorySummary(senderNumber, summary);
    // }
  } catch (error) {
    console.error("❌ Error in handlePrivateChat:", error.message);
    console.error(error.stack);
    try {
      await message.reply("Maaf, terjadi kesalahan. Mohon coba lagi.");
    } catch (replyError) {
      console.error("❌ Failed to send error message:", replyError.message);
    }
  }
}

// ============================================
// HANDLER: GROUP CHAT
// ============================================
/**
 * Handle pesan dari group chat
 *
 * PENTING:
 * - Bot HANYA merespons jika DI-TAG/MENTION
 * - Tidak semua pesan group disimpan, hanya yang relevan
 * - Memori per user per group (kombinasi group_id + user_number)
 *
 * FLOW:
 * 1. Cek apakah bot di-mention
 * 2. Jika TIDAK di-mention → abaikan (return)
 * 3. Jika di-mention:
 *    a. Get/create group info
 *    b. Get/create user session di group
 *    c. Simpan pesan user ke group_chat_history
 *    d. Ambil beberapa chat terakhir user ini di group ini (5-10)
 *    e. Panggil LLM dengan konteks tersebut
 *    f. Simpan balasan bot ke group_chat_history
 *    g. Kirim balasan ke group (reply ke message)
 */
async function handleGroupChat(message, chat, senderNumber, contact) {
  try {
    console.log("   🔹 Handling GROUP chat...");
    console.log(`   Group: ${chat.name}`);

    // 1. Cek apakah bot di-mention/tag
    const botMentioned = await groupChat.isBotMentioned(message, client);

    if (!botMentioned) {
      console.log("   ⏭️  Bot not mentioned, skipping...");
      return; // Bot tidak di-tag, abaikan pesan ini
    }

    console.log("   ✅ Bot mentioned! Processing...");

    const groupId = chat.id._serialized;
    const userNumber = senderNumber.split("@")[0] + "@c.us"; // Normalize user number

    // 2. Get/create group info
    await groupChat.getOrCreateGroup(groupId, chat.name);

    // 3. Get/create user session di group ini
    await groupChat.getOrCreateGroupUserSession(groupId, userNumber);

    // 4. Simpan pesan user ke database
    // Bersihkan mention dari message body agar lebih clean
    const cleanMessage = message.body.replace(/@\d+/g, "").trim();
    await groupChat.saveGroupChatHistory(
      groupId,
      userNumber,
      "user",
      cleanMessage
    );

    // 5. Ambil chat history terbatas untuk user ini di group ini
    // PENTING: Hanya history user ini, bukan seluruh chat group
    const history = await groupChat.getGroupChatHistory(groupId, userNumber);
    console.log(
      `   📚 Loaded ${history.length} group chat history (limit: ${config.bot.chatHistoryLimit})`
    );

    // 6. Panggil LLM untuk generate respons
    const botResponse = await llm.callLLM(history, cleanMessage, {
      userName: contact.pushname || contact.name,
      isGroup: true,
      groupName: chat.name,
    });

    // 7. Simpan balasan bot ke database
    await groupChat.saveGroupChatHistory(
      groupId,
      userNumber,
      "assistant",
      botResponse
    );

    // 8. Kirim balasan ke group (reply ke message yang mention bot)
    await message.reply(botResponse);
    console.log("   ✅ Reply sent to group");

    // Optional: Update context summary untuk user ini di group ini
    // const allHistory = await groupChat.getGroupChatHistory(groupId, userNumber, 999);
    // if (allHistory.length % 15 === 0) {
    //   const context = await llm.generateMemorySummary(allHistory);
    //   await groupChat.updateGroupUserContext(groupId, userNumber, context);
    // }
  } catch (error) {
    console.error("❌ Error in handleGroupChat:", error.message);
    console.error(error.stack);
    try {
      await message.reply("Maaf, terjadi kesalahan. Mohon coba lagi.");
    } catch (replyError) {
      console.error("❌ Failed to send error message:", replyError.message);
    }
  }
}

// ============================================
// MAIN FUNCTION
// ============================================
async function main() {
  try {
    console.log("🚀 Starting WhatsApp Bot...\n");

    // 1. Connect ke MySQL
    console.log("📦 Connecting to database...");
    await db.initDatabase();

    // 2. Initialize WhatsApp client
    console.log("\n📱 Initializing WhatsApp client...");
    console.log("   Tunggu QR code untuk scan...\n");
    await client.initialize();
  } catch (error) {
    console.error("❌ Fatal error:", error.message);
    process.exit(1);
  }
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
process.on("SIGINT", async () => {
  console.log("\n\n⚠️  Shutting down bot gracefully...");
  await client.destroy();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n\n⚠️  Shutting down bot gracefully...");
  await client.destroy();
  process.exit(0);
});

// ============================================
// START BOT
// ============================================
main();

// ============================================
// NOTES & DOKUMENTASI
// ============================================
/**
 * ARSITEKTUR MEMORI:
 *
 * 1. PRIVATE CHAT:
 *    - Setiap user punya profil di `wa_users`
 *    - Semua chat disimpan di `chat_history`
 *    - Yang dikirim ke LLM: hanya 5-10 pesan terakhir (CHAT_HISTORY_LIMIT)
 *    - Context dikirim sebagai FULL TEXT (bukan embedding)
 *
 * 2. GROUP CHAT:
 *    - Bot hanya respons jika DI-TAG/MENTION
 *    - Setiap group punya record di `wa_groups`
 *    - Setiap user di group punya sesi di `wa_group_user_sessions`
 *    - History disimpan di `group_chat_history` per kombinasi (group_id + user_number)
 *    - Yang dikirim ke LLM: hanya 5-10 pesan terakhir user tersebut di group tersebut
 *    - TIDAK mengirim seluruh isi chat group ke LLM
 *
 * 3. LIMIT MEMORI:
 *    - Angka 5-10 dikonfigurasi via CHAT_HISTORY_LIMIT di .env
 *    - Tujuan: hemat token LLM, jaga konteks relevan
 *    - Semua history tetap tersimpan di DB untuk audit
 *
 * 4. RAG/EMBEDDING:
 *    - Belum diimplementasi
 *    - Bisa ditambahkan nanti untuk knowledge base/dokumen panjang
 *    - Saat ini context dikirim sebagai plain text
 *
 * CARA MENJALANKAN:
 *
 * 1. Setup Database:
 *    $ docker compose up -d
 *    $ docker compose ps  # Pastikan MySQL running
 *
 * 2. Install Dependencies:
 *    $ npm install
 *
 * 3. Konfigurasi:
 *    - Edit .env sesuai kebutuhan
 *    - Set OPENAI_API_KEY jika mau pakai OpenAI (optional)
 *
 * 4. Jalankan Bot:
 *    $ npm start
 *    atau
 *    $ node index.js
 *
 * 5. Scan QR Code:
 *    - QR code akan muncul di terminal
 *    - Scan dengan WhatsApp di HP
 *    - Bot siap menerima pesan!
 *
 * TESTING:
 *
 * 1. Private Chat:
 *    - Chat langsung ke nomor bot
 *    - Bot akan balas semua pesan
 *
 * 2. Group Chat:
 *    - Tambahkan bot ke group
 *    - Tag/mention bot dalam pesan: "@Bot halo"
 *    - Bot hanya balas jika di-tag
 */

// ============================================================================
// PROCESS ERROR HANDLERS
// ============================================================================

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n⚠️  SIGINT received, shutting down gracefully...");
  if (client) {
    await client.destroy();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n⚠️  SIGTERM received, shutting down gracefully...");
  if (client) {
    await client.destroy();
  }
  process.exit(0);
});
