// ============================================
// DATABASE CONNECTION - MySQL via mysql2
// ============================================
const mysql = require("mysql2/promise");
const config = require("./config");

let pool;

/**
 * Inisialisasi connection pool ke MySQL
 * Di Mac, akan connect ke localhost:3306 (MySQL di Docker)
 */
async function initDatabase() {
  try {
    pool = mysql.createPool(config.db);

    // Test connection
    const connection = await pool.getConnection();
    console.log("✅ Database connected successfully!");
    console.log(`   Host: ${config.db.host}:${config.db.port}`);
    console.log(`   Database: ${config.db.database}`);
    connection.release();

    return pool;
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    console.error(
      "   Pastikan Docker MySQL sudah berjalan: docker compose up -d"
    );
    process.exit(1);
  }
}

/**
 * Get connection pool
 */
function getPool() {
  if (!pool) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return pool;
}

/**
 * Execute query with error handling
 */
async function query(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error("❌ Database query error:", error.message);
    console.error("   SQL:", sql);
    throw error;
  }
}

module.exports = {
  initDatabase,
  getPool,
  query,
};
