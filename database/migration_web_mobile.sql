-- ============================================
-- MIGRATION: Web & Mobile Users
-- ============================================

-- Table untuk web/mobile users (berbeda dengan WhatsApp users)
CREATE TABLE IF NOT EXISTS web_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  api_key VARCHAR(64) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  INDEX idx_email (email),
  INDEX idx_api_key (api_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table untuk chat history web/mobile (terpisah dari WhatsApp)
CREATE TABLE IF NOT EXISTS web_chat_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  role ENUM('user', 'assistant') NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES web_users(id) ON DELETE CASCADE,
  INDEX idx_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample user untuk testing
-- API Key: generated dengan crypto.randomBytes(32).toString('hex')
INSERT INTO web_users (email, full_name, api_key) VALUES 
('test@masterdiskon.com', 'Test User', 'sample_api_key_12345678901234567890123456789012')
ON DUPLICATE KEY UPDATE email=email;
