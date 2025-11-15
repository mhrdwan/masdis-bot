// ============================================
// LLM SERVICE - Google Gemini Integration
// ============================================

const config = require("./config");

/**
 * Memanggil Google Gemini API untuk generate respons
 *
 * @param {Array} history - Array of chat messages [{role: 'user'|'assistant', message: 'text'}]
 * @param {String} userMessage - Pesan terbaru dari user
 * @param {Object} context - Konteks tambahan
 * @returns {String} - Respons dari Gemini
 */
async function callLLM(history = [], userMessage = "", context = {}) {
  try {
    console.log("🤖 Calling Google Gemini...");
    console.log(`   History messages: ${history.length}`);
    console.log(`   User message: ${userMessage.substring(0, 50)}...`);

    // Jika tidak ada API key, gunakan dummy response
    if (!process.env.GEMINI_API_KEY) {
      console.log("   ⚠️  No GEMINI_API_KEY configured, using dummy response");
      await sleep(500);
      return `Halo! Saya bot AI (dummy mode). Pesan Anda: "${userMessage}". Saya punya ${history.length} pesan sebagai konteks.`;
    }

    // Build system instruction
    const systemInstruction = buildSystemPrompt(context);

    // Format history untuk Gemini
    // Gemini format: { role: 'user'|'model', parts: [{ text: 'content' }] }
    const contents = [];

    // Tambahkan system prompt sebagai pesan pertama dari user
    // karena v1 API tidak support system_instruction field
    contents.push({
      role: "user",
      parts: [{ text: systemInstruction }],
    });

    // Model acknowledge system prompt
    contents.push({
      role: "model",
      parts: [
        { text: "Understood. I will act according to these instructions." },
      ],
    });

    // Tambahkan history
    for (const msg of history) {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.message }],
      });
    }

    // Tambahkan pesan user terbaru
    contents.push({
      role: "user",
      parts: [{ text: userMessage }],
    });

    // Call Gemini API v1 (tidak pakai system_instruction field)
    const model = process.env.GEMINI_MODEL || "gemini-pro";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: contents,
          generationConfig: {
            temperature: parseFloat(process.env.GEMINI_TEMPERATURE || "0.7"),
            maxOutputTokens: parseInt(process.env.GEMINI_MAX_TOKENS || "500"),
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("   ❌ Gemini API error:", response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract response text
    if (
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts
    ) {
      const assistantMessage = data.candidates[0].content.parts[0].text;
      console.log("   ✅ Gemini response received");

      // Format untuk WhatsApp
      const formattedMessage = formatForWhatsApp(assistantMessage);
      return formattedMessage;
    } else {
      throw new Error("Invalid response format from Gemini");
    }
  } catch (error) {
    console.error("❌ Gemini LLM error:", error.message);
    // Fallback response
    return "Maaf, saya sedang mengalami gangguan. Mohon coba lagi nanti.";
  }
}

/**
 * Format text untuk WhatsApp dengan markdown yang proper
 * Mengkonversi markdown umum ke format WhatsApp
 */
function formatForWhatsApp(text) {
  let formatted = text;

  // 1. Convert markdown headers dulu (sebelum bold/italic processing)
  formatted = formatted.replace(/^### (.+)$/gm, "*$1*");
  formatted = formatted.replace(/^## (.+)$/gm, "*$1*");
  formatted = formatted.replace(/^# (.+)$/gm, "*$1*\n");

  // 2. Convert code blocks (protect dari formatting lain)
  const codeBlocks = [];
  formatted = formatted.replace(/```([^`]+)```/g, (match, code) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // 3. Convert inline code
  const inlineCodes = [];
  formatted = formatted.replace(/`([^`]+)`/g, (match, code) => {
    inlineCodes.push(`\`\`\`${code}\`\`\``);
    return `__INLINE_CODE_${inlineCodes.length - 1}__`;
  });

  // 4. Convert **bold** dan __bold__ ke *bold* (WhatsApp)
  formatted = formatted.replace(/\*\*([^\*]+?)\*\*/g, "*$1*");
  formatted = formatted.replace(/__([^_]+?)__/g, "*$1*");

  // 5. Convert ~~strikethrough~~
  formatted = formatted.replace(/~~([^~]+?)~~/g, "~$1~");

  // 6. Convert bullet points: - item atau * item ke • item
  // Harus setelah bold processing
  formatted = formatted.replace(/^\s*[\-\*]\s+(.+)$/gm, "• $1");

  // 7. Convert numbered list dengan proper spacing
  formatted = formatted.replace(/^\s*(\d+)\.\s+(.+)$/gm, "$1. $2");

  // 8. Restore code blocks dan inline codes
  codeBlocks.forEach((block, index) => {
    formatted = formatted.replace(`__CODE_BLOCK_${index}__`, block);
  });
  inlineCodes.forEach((code, index) => {
    formatted = formatted.replace(`__INLINE_CODE_${index}__`, code);
  });

  // 9. Bersihkan multiple line breaks (max 2)
  formatted = formatted.replace(/\n{3,}/g, "\n\n");

  // 10. Trim whitespace di awal dan akhir
  formatted = formatted.trim();

  return formatted;
}

/**
 * Build system prompt berdasarkan konteks
 */
function buildSystemPrompt(context) {
  let prompt = `Kamu adalah asisten AI customer service untuk Masterdiskon, perusahaan travel terpercaya di Indonesia.

INFORMASI PERUSAHAAN:
- Nama: PT Master Diskon Internasional (Brand: Masterdiskon)
- Tagline: "Travel, Live, Discover"
- Didirikan: 2019 (Pengalaman 5+ tahun)
- Lokasi: Jl. H. Baping No. 100, Susukan, Ciracas, Jakarta Timur, DKI Jakarta 13740

LAYANAN KAMI:
1. Tiket Pesawat (Domestik & Internasional)
2. Hotel & Resort (Akomodasi)
3. Tiket Kereta Api
4. Paket Tour
5. Layanan perjalanan lainnya

KEUNGGULAN:
- Kemudahan pemesanan dalam satu aplikasi
- Pilihan perjalanan lengkap dan beragam
- Pengalaman liburan nyaman dan aman
- Metode pembayaran yang lengkap

KONTAK:
- Email: cs@masterdiskon.com
- WhatsApp: 0822 5500 3535
- Telepon: (021) 27811300
- Sosial Media: Twitter, Instagram, Facebook, YouTube, TikTok

CARA MENJAWAB:
- Ramah, profesional, dan helpful
- Jawab dalam Bahasa Indonesia
- Singkat dan jelas
- Jika ditanya tentang pemesanan/booking, arahkan ke kontak customer service
- Jika ditanya harga, jelaskan bahwa harga bervariasi dan sarankan hubungi CS untuk penawaran terbaik

FORMAT PESAN (gunakan markdown):
- Gunakan **bold** untuk judul, poin penting, atau nama layanan
- Gunakan *italic* untuk emphasis ringan
- Gunakan - atau * untuk bullet points
- Gunakan numbered list (1. 2. 3.) untuk langkah-langkah
- Pisahkan paragraf dengan line break untuk readability
- Gunakan emoji yang relevan jika sesuai (✈️ 🏨 🚂 🎉 📞 dll)`;

  if (context.userName) {
    prompt += `\n\nKamu sedang berbicara dengan: ${context.userName}`;
  }

  if (context.isGroup) {
    prompt += `\n\nPercakapan ini terjadi di grup WhatsApp "${
      context.groupName || "group"
    }". Hanya jawab jika kamu di-tag/mention.`;
  } else {
    prompt += "\n\nPercakapan ini adalah private chat.";
  }

  return prompt;
}

/**
 * Helper: sleep untuk simulasi delay
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate ringkasan memori (untuk memory_summary atau context field)
 * Ini adalah fungsi dummy, bisa diimplementasikan dengan LLM juga
 *
 * @param {Array} allHistory - Semua history chat user
 * @returns {String} - Ringkasan singkat
 */
async function generateMemorySummary(allHistory) {
  // Dummy implementation
  if (allHistory.length === 0) {
    return "User baru, belum ada history.";
  }

  const lastFewMessages = allHistory
    .slice(-5)
    .map((msg) => msg.message)
    .join(" ");
  const summary = `User terakhir membahas: ${lastFewMessages.substring(
    0,
    100
  )}...`;

  return summary;
}

module.exports = {
  callLLM,
  generateMemorySummary,
};
