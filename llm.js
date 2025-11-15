// ============================================
// LLM SERVICE - Integrasi dengan AI/LLM
// ============================================
// File ini adalah placeholder untuk integrasi dengan LLM (OpenAI, Anthropic, dll)
// Bisa diganti dengan implementasi asli sesuai provider yang digunakan

const config = require("./config");

/**
 * Memanggil LLM untuk generate respons berdasarkan chat history
 *
 * @param {Array} history - Array of chat messages [{role: 'user'|'assistant', content: 'message'}]
 * @param {String} userMessage - Pesan terbaru dari user
 * @param {Object} context - Konteks tambahan (misal: nama user, group info, dll)
 * @returns {String} - Respons dari LLM
 *
 * CATATAN PENTING:
 * - history berisi 5-10 pesan terakhir (sesuai CHAT_HISTORY_LIMIT)
 * - Dikirim sebagai FULL TEXT, bukan embedding
 * - Tujuan: hemat token dan jaga konteks tetap relevan
 * - Untuk knowledge base/dokumen panjang, bisa tambahkan RAG/embedding nanti
 */
async function callLLM(history = [], userMessage = "", context = {}) {
  try {
    console.log("🤖 Calling LLM...");
    console.log(`   History messages: ${history.length}`);
    console.log(`   User message: ${userMessage.substring(0, 50)}...`);

    // Format messages untuk LLM API
    // Format standar OpenAI: [{role: 'system'|'user'|'assistant', content: 'text'}]
    const messages = [
      {
        role: "system",
        content: buildSystemPrompt(context),
      },
      // Tambahkan history chat (5-10 pesan terakhir)
      ...history.map((msg) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.message,
      })),
      // Tambahkan pesan user terbaru
      {
        role: "user",
        content: userMessage,
      },
    ];

    // ============================================
    // OPSI 1: DUMMY RESPONSE (untuk testing tanpa API key)
    // ============================================
    // Uncomment ini jika belum punya API key LLM
    /*
    console.log('   Using dummy response (no API key configured)');
    await sleep(1000); // Simulate API delay
    return `Halo! Saya adalah bot AI. Anda bilang: "${userMessage}". Saya menerima ${history.length} pesan history sebagai konteks.`;
    */

    // ============================================
    // OPSI 2: INTEGRASI OPENAI API
    // ============================================
    // Uncomment ini jika sudah punya OPENAI_API_KEY
    if (!config.llm.apiKey) {
      console.log("   ⚠️  No API key configured, using dummy response");
      await sleep(500);
      return `Halo! Saya bot AI. Pesan Anda: "${userMessage}". Context: ${history.length} pesan sebelumnya.`;
    }

    const response = await fetch(config.llm.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.llm.apiKey}`,
      },
      body: JSON.stringify({
        model: config.llm.model,
        messages: messages,
        max_tokens: config.llm.maxTokens,
        temperature: config.llm.temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `LLM API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

    console.log("   ✅ LLM response received");
    return assistantMessage;

    // ============================================
    // OPSI 3: PROVIDER LAIN (Anthropic, local LLM, dll)
    // ============================================
    // Implementasi bisa disesuaikan dengan provider yang digunakan
    // Contoh: Anthropic Claude, Ollama (local), dll
  } catch (error) {
    console.error("❌ LLM error:", error.message);
    // Fallback response jika LLM gagal
    return "Maaf, saya sedang mengalami gangguan. Mohon coba lagi nanti.";
  }
}

/**
 * Build system prompt berdasarkan konteks
 */
function buildSystemPrompt(context) {
  let prompt = "Kamu adalah asisten AI yang helpful dan ramah.";

  if (context.userName) {
    prompt += ` Kamu sedang berbicara dengan ${context.userName}.`;
  }

  if (context.isGroup) {
    prompt += ` Percakapan ini terjadi di grup WhatsApp "${
      context.groupName || "group"
    }".`;
  } else {
    prompt += " Percakapan ini adalah private chat.";
  }

  prompt += " Jawab dengan singkat dan jelas dalam Bahasa Indonesia.";

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
  // Bisa diimplementasikan dengan memanggil LLM untuk summarize
  // Atau pakai algoritma sederhana untuk extract keyword

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
