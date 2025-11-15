// ============================================
// START API SERVER ONLY
// ============================================

require("dotenv").config();
const { startAPIServer } = require("./api-server");

console.log("🚀 Starting Masterdiskon Chat API Server...\n");

// Start API server
startAPIServer();
