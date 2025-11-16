// ============================================
// REST API SERVER untuk Web & Mobile (Sandbox Mode)
// ============================================
// Simple API tanpa authentication, hanya butuh email
// Untuk sandbox/testing purpose

const express = require("express");
const cors = require("cors");
const webChat = require("./services/webChat");
const llm = require("./llm-gemini");
const db = require("./database");
const hotelBooking = require("./services/hotelBooking");

const app = express();
const PORT = process.env.API_PORT || 3000;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert WhatsApp formatting to HTML
 * *bold* -> <strong>bold</strong>
 * _italic_ -> <em>italic</em>
 * ~strikethrough~ -> <del>strikethrough</del>
 * • bullet -> <li>bullet</li>
 * \n\n -> <br><br>
 */
function convertWhatsAppToHTML(text) {
  if (!text) return "";

  let html = text;

  // Convert bold: *text* -> <strong>text</strong>
  html = html.replace(/\*([^*]+)\*/g, "<strong>$1</strong>");

  // Convert italic: _text_ -> <em>text</em>
  html = html.replace(/_([^_]+)_/g, "<em>$1</em>");

  // Convert strikethrough: ~text~ -> <del>text</del>
  html = html.replace(/~([^~]+)~/g, "<del>$1</del>");

  // Convert bullet points: • text -> <li>text</li>
  const lines = html.split("\n");
  let inList = false;
  const processedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith("•") || line.startsWith("-")) {
      if (!inList) {
        processedLines.push("<ul>");
        inList = true;
      }
      const content = line.substring(1).trim();
      processedLines.push(`<li>${content}</li>`);
    } else {
      if (inList) {
        processedLines.push("</ul>");
        inList = false;
      }
      if (line) {
        processedLines.push(line);
      }
    }
  }

  if (inList) {
    processedLines.push("</ul>");
  }

  html = processedLines.join("\n");

  // Convert newlines to <br>
  html = html.replace(/\n/g, "<br>");

  // Clean up multiple <br> tags
  html = html.replace(/(<br>){3,}/g, "<br><br>");

  return html;
}

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// ENDPOINTS
// ============================================

/**
 * GET /api/health
 * Health check endpoint
 */
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Masterdiskon Chat API is running",
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/chat/send
 * Send message dan dapat response dari AI
 *
 * Body:
 *   {
 *     "email": "user@example.com",
 *     "name": "John Doe" (optional),
 *     "message": "Halo, saya ingin booking hotel"
 *   }
 *
 * Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "user_message": "Halo...",
 *       "bot_response": "Halo! Ada yang...",
 *       "timestamp": "2025-11-15T..."
 *     }
 *   }
 */
app.post("/api/chat/send", async (req, res) => {
  try {
    const { email, name, message } = req.body;

    // Validasi
    if (!email || typeof email !== "string" || email.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Message is required and must be a non-empty string",
      });
    }

    const userEmail = email.trim().toLowerCase();
    const userMessage = message.trim();
    const userName = name ? name.trim() : null;

    console.log(
      `📨 API Chat from ${userEmail}: ${userMessage.substring(0, 50)}...`
    );

    // 1. Get or create user
    await webChat.getOrCreateWebUser(userEmail, userName);

    // 2. Save user message
    await webChat.saveWebChatHistory(userEmail, "user", userMessage);

    // 3. Check if this is hotel booking request (PRIORITY CHECK)
    const hotelResponse = await hotelBooking.handleHotelBooking(
      userEmail,
      userMessage,
      userName || userEmail
    );

    let botResponse;
    let apiData = null;

    if (hotelResponse) {
      // Hotel booking flow response
      if (typeof hotelResponse === "object" && hotelResponse.text) {
        // Response with API data
        botResponse = hotelResponse.text;
        apiData = hotelResponse.apiResponse;
      } else {
        // Simple string response
        botResponse = hotelResponse;
      }
      console.log(`   🏨 Hotel booking flow activated`);
    } else {
      // 4. Get chat history (10 terakhir)
      const history = await webChat.getWebChatHistory(userEmail, 10);

      // 5. Call LLM untuk generate response
      botResponse = await llm.callLLM(history, userMessage, {
        userName: userName || userEmail,
        isGroup: false,
        source: "web_api",
      });
    }

    // 6. Save bot response
    await webChat.saveWebChatHistory(userEmail, "assistant", botResponse);

    // 7. Convert response to HTML
    const botResponseHTML = convertWhatsAppToHTML(botResponse);

    // 8. Return response (both formats)
    const responseData = {
      user_message: userMessage,
      bot_response: botResponse, // Original WhatsApp format
      bot_response_html: botResponseHTML, // HTML format untuk web
      timestamp: new Date().toISOString(),
    };

    // Include API response if available
    if (apiData) {
      responseData.api_response = apiData;
    }

    res.json({
      success: true,
      data: responseData,
    });

    console.log(`✅ API Response sent to ${userEmail}`);
  } catch (error) {
    console.error("❌ API chat/send error:", error.message);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

/**
 * GET /api/chat/history?email=user@example.com
 * Get chat history (default 10 messages terakhir)
 *
 * Query Params:
 *   email: string (required)
 *   limit: number (optional, default 10)
 *
 * Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "email": "user@example.com",
 *       "history": [
 *         {
 *           "role": "user",
 *           "message": "Halo",
 *           "created_at": "2025-11-15T..."
 *         },
 *         ...
 *       ],
 *       "total": 10
 *     }
 *   }
 */
app.get("/api/chat/history", async (req, res) => {
  try {
    const { email } = req.query;
    // Jika tidak ada limit dari FE, ambil semua (max 1000)
    // Jika ada limit, gunakan limit tersebut (max 1000)
    const limit = req.query.limit
      ? Math.min(parseInt(req.query.limit), 1000)
      : 1000;

    if (!email || typeof email !== "string" || email.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Email is required as query parameter",
      });
    }

    const userEmail = email.trim().toLowerCase();

    console.log(
      `📚 API History request for ${userEmail} (limit: ${
        limit === 1000 ? "ALL" : limit
      })`
    );

    const history = await webChat.getAllWebChatHistory(userEmail, limit);

    // Convert messages to HTML format
    const historyWithHTML = history.map((msg) => ({
      role: msg.role,
      message: msg.message, // Original format
      message_html: convertWhatsAppToHTML(msg.message), // HTML format
      created_at: msg.created_at,
    }));

    res.json({
      success: true,
      data: {
        email: userEmail,
        history: historyWithHTML,
        total: history.length,
      },
    });

    console.log(`✅ API History sent: ${history.length} messages`);
  } catch (error) {
    console.error("❌ API chat/history error:", error.message);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

/**
 * POST /api/chat/reset
 * Clear conversation state untuk user (reset hotel booking flow)
 *
 * Body:
 *   {
 *     "email": "user@example.com"
 *   }
 *
 * Response:
 *   {
 *     "success": true,
 *     "message": "Conversation state cleared for user@example.com"
 *   }
 */
app.post("/api/chat/reset", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string" || email.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    const userEmail = email.trim().toLowerCase();

    console.log(`🔄 API Reset conversation state for ${userEmail}`);

    // Import conversationState module
    const conversationState = require("./services/conversationState");
    conversationState.clearConversationState(userEmail);

    res.json({
      success: true,
      message: `Conversation state cleared for ${userEmail}`,
    });

    console.log(`✅ Conversation state cleared for ${userEmail}`);
  } catch (error) {
    console.error("❌ API chat/reset error:", error.message);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// ============================================
// ERROR HANDLERS
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

// ============================================
// START SERVER
// ============================================
async function startAPIServer() {
  // Initialize database first
  await db.initDatabase();

  app.listen(PORT, () => {
    console.log(`\n🌐 REST API Server (Sandbox Mode) running on port ${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health`);
    console.log(`   Chat: POST http://localhost:${PORT}/api/chat/send`);
    console.log(
      `   History: GET http://localhost:${PORT}/api/chat/history?email=xxx`
    );
    console.log(
      `   Register endpoint: POST http://localhost:${PORT}/api/user/register\n`
    );
  });
}

module.exports = { app, startAPIServer };
