-- ============================================
-- WHATSAPP BOT DATABASE SCHEMA
-- ============================================
-- Database ini dirancang untuk menyimpan:
-- 1. Data user private chat
-- 2. History chat private (dengan limit yang dikirim ke LLM)
-- 3. Data group WhatsApp
-- 4. Sesi user per group (memori per user per group)
-- 5. History chat group (khusus saat bot di-tag)

-- ============================================
-- TABLE: wa_users
-- ============================================
-- Menyimpan profil user untuk private chat.
-- Setiap user diidentifikasi oleh nomor WhatsApp unik.
-- memory_summary bisa digunakan untuk menyimpan ringkasan konteks jangka panjang (optional).
CREATE TABLE IF NOT EXISTS wa_users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    wa_number VARCHAR(50) NOT NULL UNIQUE COMMENT 'Nomor WhatsApp user (format: 628xxx@c.us)',
    name VARCHAR(255) DEFAULT NULL COMMENT 'Nama user dari WhatsApp profile',
    memory_summary TEXT DEFAULT NULL COMMENT 'Ringkasan memori/konteks user untuk referensi bot',
    last_interaction DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Waktu terakhir user berinteraksi',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_last_interaction (last_interaction),
    INDEX idx_wa_number (wa_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Profil user untuk private chat';

-- ============================================
-- TABLE: chat_history
-- ============================================
-- Menyimpan seluruh history chat private antara user dan bot.
-- Semua pesan disimpan di sini, tapi yang dikirim ke LLM hanya N pesan terakhir (misal 5-10).
-- Ini adalah "short-term memory" yang dikirim sebagai FULL TEXT ke LLM.
CREATE TABLE IF NOT EXISTS chat_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    wa_number VARCHAR(50) NOT NULL COMMENT 'Nomor WhatsApp user',
    role ENUM('user', 'assistant') NOT NULL COMMENT 'user = pesan dari user, assistant = balasan dari bot',
    message TEXT NOT NULL COMMENT 'Isi pesan (full text)',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Waktu pesan dibuat',
    INDEX idx_wa_number_created (wa_number, created_at DESC) COMMENT 'Index untuk query pesan terakhir per user',
    FOREIGN KEY (wa_number) REFERENCES wa_users(wa_number) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='History chat private (semua disimpan, tapi hanya beberapa terakhir dikirim ke LLM)';

-- ============================================
-- TABLE: wa_groups
-- ============================================
-- Menyimpan informasi group WhatsApp tempat bot aktif.
-- group_id adalah ID unik dari WhatsApp.js (biasanya format: 123456789-1234567890@g.us).
CREATE TABLE IF NOT EXISTS wa_groups (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    group_id VARCHAR(100) NOT NULL UNIQUE COMMENT 'ID unik group dari WhatsApp.js',
    group_name VARCHAR(255) DEFAULT NULL COMMENT 'Nama group',
    last_active DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Waktu terakhir ada aktivitas di group',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_group_id (group_id),
    INDEX idx_last_active (last_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Informasi group WhatsApp';

-- ============================================
-- TABLE: wa_group_user_sessions
-- ============================================
-- Menyimpan memori PER USER PER GROUP.
-- Kombinasi group_id + user_number adalah unique identifier untuk sesi user di group tertentu.
-- context bisa dipakai untuk ringkasan singkat (misal: "User ini sering bertanya tentang produk X").
CREATE TABLE IF NOT EXISTS wa_group_user_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    group_id VARCHAR(100) NOT NULL COMMENT 'ID group',
    user_number VARCHAR(50) NOT NULL COMMENT 'Nomor WhatsApp user dalam group',
    context TEXT DEFAULT NULL COMMENT 'Ringkasan konteks singkat untuk user ini di group ini',
    last_interaction DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Waktu terakhir user tag bot di group ini',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_group_user (group_id, user_number) COMMENT 'Satu user hanya punya satu sesi per group',
    INDEX idx_group_user (group_id, user_number),
    INDEX idx_last_interaction (last_interaction),
    FOREIGN KEY (group_id) REFERENCES wa_groups(group_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Memori per user per group';

-- ============================================
-- TABLE: group_chat_history
-- ============================================
-- Menyimpan history chat di group, KHUSUS interaksi saat bot di-tag.
-- Tidak semua pesan group disimpan, hanya yang relevan (user tag bot + balasan bot).
-- Yang dikirim ke LLM hanya beberapa pesan terakhir (5-10) dari kombinasi group_id + user_number.
CREATE TABLE IF NOT EXISTS group_chat_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    group_id VARCHAR(100) NOT NULL COMMENT 'ID group',
    user_number VARCHAR(50) NOT NULL COMMENT 'Nomor WhatsApp pengirim pesan',
    role ENUM('user', 'assistant') NOT NULL COMMENT 'user = pesan dari user (tag bot), assistant = balasan bot',
    message TEXT NOT NULL COMMENT 'Isi pesan (full text)',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Waktu pesan dibuat',
    INDEX idx_group_user_created (group_id, user_number, created_at DESC) COMMENT 'Index untuk query pesan terakhir per user per group',
    FOREIGN KEY (group_id) REFERENCES wa_groups(group_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='History chat group (hanya yang relevan: tag bot + balasan)';

-- ============================================
-- NOTES TENTANG ARSITEKTUR MEMORI:
-- ============================================
-- 1. PRIVATE CHAT:
--    - Semua pesan disimpan di chat_history.
--    - Saat panggil LLM: ambil 5-10 pesan terakhir dari chat_history berdasarkan wa_number.
--    - Ini adalah "short-term memory" yang dikirim sebagai FULL TEXT (bukan embedding).
--
-- 2. GROUP CHAT:
--    - Bot hanya merespons jika di-tag/mention.
--    - Setiap user di group punya sesi terpisah (wa_group_user_sessions).
--    - History interaksi disimpan di group_chat_history per kombinasi group_id + user_number.
--    - Saat user tag bot: ambil 5-10 pesan terakhir dari group_chat_history untuk group_id + user_number tersebut.
--    - Tidak semua chat group disimpan, hanya yang relevan (tag bot).
--
-- 3. LIMIT MEMORI:
--    - Angka 5-10 bisa dikonfigurasi di aplikasi Node.js.
--    - Tujuan: hemat token LLM dan jaga konteks tetap relevan.
--    - Semua history tetap tersimpan di DB untuk audit/analitik.
--
-- 4. RAG/EMBEDDING:
--    - Saat ini belum diimplementasi.
--    - Bisa ditambahkan nanti untuk knowledge base/dokumen panjang.
--    - Untuk sekarang, context dikirim sebagai plain text ke LLM.

-- ============================================
-- TABLE: web_users (untuk Web & Mobile App)
-- ============================================
-- User dari web/mobile diidentifikasi hanya dengan email (sandbox mode)
-- Tidak ada password/auth, langsung bisa chat
CREATE TABLE IF NOT EXISTS web_users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE COMMENT 'Email user sebagai identifier',
    name VARCHAR(255) DEFAULT NULL COMMENT 'Nama user (optional)',
    last_interaction DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Waktu terakhir user berinteraksi',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_last_interaction (last_interaction)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='User dari Web & Mobile (sandbox mode)';

-- ============================================
-- TABLE: web_chat_history
-- ============================================
-- History chat untuk user web/mobile
-- Mirip dengan chat_history tapi untuk platform web/mobile
CREATE TABLE IF NOT EXISTS web_chat_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL COMMENT 'Email user',
    role ENUM('user', 'assistant') NOT NULL COMMENT 'user = pesan dari user, assistant = balasan dari bot',
    message TEXT NOT NULL COMMENT 'Isi pesan (full text)',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Waktu pesan dibuat',
    INDEX idx_email_created (email, created_at DESC) COMMENT 'Index untuk query pesan terakhir per user',
    FOREIGN KEY (email) REFERENCES web_users(email) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='History chat untuk web/mobile users';
