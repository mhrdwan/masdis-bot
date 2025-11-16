// ============================================
// HOTEL BOOKING HANDLER
// ============================================

const hotelService = require("./hotelService");
const conversationState = require("./conversationState");

/**
 * Extract budget dari pesan user
 * Contoh: "budget 500rb", "maksimal 1juta", "500000", "dibawah 1jt"
 * @returns {number|null} Budget dalam Rupiah
 */
function extractBudget(message) {
  const lowerMsg = message.toLowerCase();

  // Pattern untuk angka dengan "rb" atau "ribu" (contoh: 500rb, 500ribu)
  const thousandPattern = /(\d+)\s*(rb|ribu|k)/i;
  const thousandMatch = lowerMsg.match(thousandPattern);
  if (thousandMatch) {
    return parseInt(thousandMatch[1]) * 1000;
  }

  // Pattern untuk juta (contoh: 1jt, 1juta, 1.5juta)
  const millionPattern = /(\d+(?:\.\d+)?)\s*(jt|juta|m)/i;
  const millionMatch = lowerMsg.match(millionPattern);
  if (millionMatch) {
    return parseFloat(millionMatch[1]) * 1000000;
  }

  // Pattern untuk angka langsung yang besar (min 50000)
  const directPattern = /(\d{5,})/;
  const directMatch = message.match(directPattern);
  if (directMatch) {
    const amount = parseInt(directMatch[1]);
    if (amount >= 50000) {
      return amount;
    }
  }

  return null;
}

/**
 * Detect apakah pesan adalah request hotel booking
 */
function isHotelRequest(message) {
  const keywords = [
    "hotel",
    "menginap",
    "nginep",
    "booking",
    "pesan hotel",
    "cari hotel",
    "penginapan",
    "akomodasi",
    "resort",
    "staycation",
    "stay",
    "check in",
    "checkin",
    "check-in",
    "inap",
    "bermalam",
    "villa",
    "guesthouse",
    "homestay",
    "apartemen",
    "apartment",
  ];

  const lowerMsg = message.toLowerCase();

  // Check keywords
  const hasKeyword = keywords.some((keyword) => lowerMsg.includes(keyword));
  if (hasKeyword) {
    return true;
  }

  // Check pattern: "di [lokasi]" dengan context perjalanan
  const locationPattern = /(di|ke|area|daerah|kota)\s+([a-zA-Z\s]+)/i;
  const travelWords = ["ingin", "mau", "butuh", "cari", "carikan", "perlu"];

  if (
    locationPattern.test(message) &&
    travelWords.some((word) => lowerMsg.includes(word))
  ) {
    return true;
  }

  return false;
}

/**
 * Detect cancel/reset keywords
 */
function isCancelRequest(message) {
  const cancelKeywords = [
    "batal",
    "cancel",
    "stop",
    "reset",
    "keluar",
    "exit",
    "quit",
    "batalkan",
    "ulang",
    "mulai lagi",
  ];

  const lowerMsg = message.toLowerCase().trim();
  return cancelKeywords.some((keyword) => lowerMsg.includes(keyword));
}

/**
 * Detect general questions (not hotel booking answers)
 */
function isGeneralQuestion(message) {
  const lowerMsg = message.toLowerCase().trim();

  const generalPatterns = [
    /^(siapa|apa|kapan|dimana|kenapa|bagaimana|berapa)/i,
    /kamu (siapa|apa|bisa|ada|punya|tau|tahu|ngapain)/i,
    /apa itu/i,
    /tolong/i,
    /bantuan/i,
    /help/i,
    /hi|halo|hello|hai|hei/i,
    /terima kasih|thanks|thank you|makasih/i,
  ];

  // Check patterns
  if (generalPatterns.some((pattern) => pattern.test(lowerMsg))) {
    return true;
  }

  // Specific check for questions about bot capabilities
  const capabilityQuestions = [
    "bisa apa",
    "bisa ngapain",
    "bisa bantu apa",
    "fungsi",
    "kegunaan",
    "manfaat",
  ];

  if (capabilityQuestions.some((q) => lowerMsg.includes(q))) {
    return true;
  }

  return false;
}

/**
 * Handle hotel booking conversation flow
 * Returns: string | null | { text: string, apiResponse: object }
 */
async function handleHotelBooking(waNumber, message, userName) {
  const state = conversationState.getConversationState(waNumber);

  // Check for cancel request (works in any state)
  if (state && isCancelRequest(message)) {
    conversationState.clearConversationState(waNumber);
    return "Pencarian hotel dibatalkan. Silakan mulai lagi jika ingin mencari hotel. 🙏";
  }

  // If user is in booking flow but asks general question, exit flow
  if (state && isGeneralQuestion(message)) {
    conversationState.clearConversationState(waNumber);
    return null; // Let it fall through to normal LLM response
  }

  // Step 1: Cari lokasi
  if (!state) {
    return await startHotelSearch(waNumber, message, userName);
  }

  // Step 2: Konfirmasi lokasi dan minta tanggal
  if (state.step === "awaiting_location_confirm") {
    return await handleLocationConfirm(waNumber, message, state);
  }

  // Step 3: Input check-in date
  if (state.step === "awaiting_checkin_date") {
    return await handleCheckInDate(waNumber, message, state);
  }

  // Step 4: Input check-out date
  if (state.step === "awaiting_checkout_date") {
    return await handleCheckOutDate(waNumber, message, state);
  }

  // Step 5: Input jumlah tamu
  if (state.step === "awaiting_guest_count") {
    return await handleGuestCount(waNumber, message, state);
  }

  // Step 6: Input jumlah kamar
  if (state.step === "awaiting_room_count") {
    return await handleRoomCount(waNumber, message, state);
  }

  // Step 7: Input budget (optional, jika belum ada)
  if (state.step === "awaiting_budget") {
    return await handleBudget(waNumber, message, state);
  }

  return null;
}

/**
 * Step 1: Start hotel search - extract lokasi dari pesan
 */
async function startHotelSearch(waNumber, message, userName) {
  // FIRST: Check if this is actually a general question, not hotel request
  if (isGeneralQuestion(message)) {
    return null; // Let it fall through to normal LLM response
  }

  // Extract lokasi dari pesan
  // Contoh: "saya ingin menginap di jakarta"
  const locationPattern = /(di|ke|area|daerah|kota|wilayah)\s+([a-zA-Z\s]+)/i;
  const match = message.match(locationPattern);

  let query = "";
  if (match && match[2]) {
    query = match[2].trim();
  } else {
    // Coba ambil kata terakhir yang bukan keyword umum
    const words = message.toLowerCase().split(" ");
    const skipWords = [
      "hotel",
      "menginap",
      "nginep",
      "booking",
      "pesan",
      "cari",
      "di",
      "ke",
      "saya",
      "mau",
      "ingin",
      "bisa",
      "carikan",
    ];
    query = words.filter((w) => !skipWords.includes(w)).pop() || "";
  }

  if (!query) {
    return "Maaf, saya tidak bisa menangkap lokasi yang Anda maksud. Bisa tolong sebutkan kota atau daerah yang Anda tuju?\n\nContoh: Saya ingin menginap di Jakarta";
  }

  // Search location via API
  const locationResult = await hotelService.searchLocation(query);

  if (!locationResult) {
    conversationState.clearConversationState(waNumber);
    return `Maaf, saya tidak menemukan lokasi "${query}". Bisa coba dengan nama kota lain?\n\nContoh: Jakarta, Bali, Bandung, Surabaya`;
  }

  // Extract budget jika ada di pesan awal
  const budget = extractBudget(message);

  // Save state dan minta konfirmasi
  conversationState.setConversationState(
    waNumber,
    "awaiting_location_confirm",
    {
      locationResult: locationResult,
      query: query,
      budget: budget, // Simpan budget jika ada
    }
  );

  if (locationResult.type === "region") {
    return `Baik, saya menemukan wilayah: ${locationResult.name} 📍\n\nApakah lokasi ini sudah benar? (Ya/Tidak)`;
  } else {
    return `Saya menemukan hotel: ${locationResult.name} ${
      locationResult.starRating ? "⭐".repeat(locationResult.starRating) : ""
    }\n\nApakah Anda ingin cari hotel di sekitar area ini? (Ya/Tidak)`;
  }
}

/**
 * Step 2: Konfirmasi lokasi
 */
async function handleLocationConfirm(waNumber, message, state) {
  const lowerMsg = message.toLowerCase().trim();

  if (lowerMsg === "tidak" || lowerMsg === "no" || lowerMsg === "bukan") {
    conversationState.clearConversationState(waNumber);
    return "Oke, silakan sebutkan lokasi yang benar.\n\nContoh: Saya ingin menginap di Bali";
  }

  if (
    lowerMsg !== "ya" &&
    lowerMsg !== "yes" &&
    lowerMsg !== "iya" &&
    lowerMsg !== "betul"
  ) {
    return "Mohon jawab Ya atau Tidak";
  }

  // Lokasi confirmed, minta tanggal check-in
  conversationState.updateConversationData(waNumber, {
    locationConfirmed: true,
  });
  conversationState.setConversationState(
    waNumber,
    "awaiting_checkin_date",
    state.data
  );

  return `Baik! Kapan Anda ingin check-in? 📅\n\nFormat: DD-MM-YYYY atau ketik "besok"\nContoh: 16-11-2025 atau besok`;
}

/**
 * Step 3: Input check-in date
 */
async function handleCheckInDate(waNumber, message, state) {
  const checkInDate = hotelService.parseDate(message);

  if (!checkInDate) {
    return "Maaf, format tanggal tidak valid. Silakan coba lagi.\n\nContoh: 16-11-2025 atau besok";
  }

  conversationState.updateConversationData(waNumber, {
    checkInDate: checkInDate,
  });
  conversationState.setConversationState(
    waNumber,
    "awaiting_checkout_date",
    state.data
  );

  return `Check-in: ${hotelService.formatDate(
    checkInDate
  )} ✅\n\nKapan Anda ingin check-out? 📅\n\nFormat: DD-MM-YYYY\nContoh: 17-11-2025`;
}

/**
 * Step 4: Input check-out date
 */
async function handleCheckOutDate(waNumber, message, state) {
  const checkOutDate = hotelService.parseDate(message);

  if (!checkOutDate) {
    return "Maaf, format tanggal tidak valid. Silakan coba lagi.\n\nContoh: 17-11-2025";
  }

  // Validasi check-out harus setelah check-in
  const checkIn = new Date(
    state.data.checkInDate.split("-").reverse().join("-")
  );
  const checkOut = new Date(checkOutDate.split("-").reverse().join("-"));

  if (checkOut <= checkIn) {
    return "Tanggal check-out harus setelah tanggal check-in. Silakan masukkan tanggal check-out yang benar.";
  }

  conversationState.updateConversationData(waNumber, {
    checkOutDate: checkOutDate,
  });
  conversationState.setConversationState(
    waNumber,
    "awaiting_guest_count",
    state.data
  );

  return `Check-out: ${hotelService.formatDate(
    checkOutDate
  )} ✅\n\nBerapa jumlah tamu? 👥\n\nFormat: Dewasa-Anak-Bayi\nContoh: 2-0-0 (2 dewasa, tanpa anak)\nAtau ketik angka saja untuk dewasa: 2`;
}

/**
 * Step 5: Input jumlah tamu
 */
async function handleGuestCount(waNumber, message, state) {
  // Parse format: "2-1-0" atau "2" saja
  const guestPattern = /(\d+)(?:-(\d+))?(?:-(\d+))?/;
  const match = message.trim().match(guestPattern);

  if (!match) {
    return "Format tidak valid. Silakan masukkan jumlah tamu.\n\nContoh: 2-1-0 (2 dewasa, 1 anak, 0 bayi)\nAtau: 2 (2 dewasa saja)";
  }

  const adult = parseInt(match[1]) || 1;
  const child = parseInt(match[2]) || 0;
  const infant = parseInt(match[3]) || 0;

  if (adult < 1) {
    return "Minimal 1 orang dewasa. Silakan coba lagi.";
  }

  conversationState.updateConversationData(waNumber, { adult, child, infant });
  conversationState.setConversationState(
    waNumber,
    "awaiting_room_count",
    state.data
  );

  return `Tamu: ${adult} dewasa${child > 0 ? ", " + child + " anak" : ""}${
    infant > 0 ? ", " + infant + " bayi" : ""
  } ✅\n\nBerapa jumlah kamar yang dibutuhkan? 🛏️\n\nContoh: 1 atau 2`;
}

/**
 * Step 6: Input jumlah kamar
 */
async function handleRoomCount(waNumber, message, state) {
  const room = parseInt(message.trim());

  if (isNaN(room) || room < 1) {
    return "Jumlah kamar tidak valid. Minimal 1 kamar.\n\nContoh: 1";
  }

  conversationState.updateConversationData(waNumber, { room });

  // Check apakah sudah ada budget
  if (!state.data.budget) {
    // Tanya budget dulu
    conversationState.setConversationState(
      waNumber,
      "awaiting_budget",
      state.data
    );
    return `Kamar: ${room} kamar ✅\n\nApakah Anda punya budget maksimal per malam? 💰\n\nContoh: 500rb, 1juta, 1.5jt\nAtau ketik skip untuk melihat semua hotel`;
  }

  // Sudah ada budget, langsung search
  return await performHotelSearch(waNumber, state.data);
}

/**
 * Step 7: Input budget (optional)
 */
async function handleBudget(waNumber, message, state) {
  const lowerMsg = message.toLowerCase().trim();

  // Allow skip budget
  if (lowerMsg === "skip" || lowerMsg === "tidak" || lowerMsg === "no") {
    conversationState.updateConversationData(waNumber, { budget: null });
    return await performHotelSearch(waNumber, state.data);
  }

  // Extract budget dari message
  const budget = extractBudget(message);

  if (!budget) {
    return "Format budget tidak valid. Silakan coba lagi.\n\nContoh: 500rb, 1juta, 1.5jt\nAtau ketik skip untuk skip";
  }

  conversationState.updateConversationData(waNumber, { budget });

  return await performHotelSearch(waNumber, state.data);
}

/**
 * Perform hotel search dengan semua parameter
 */
async function performHotelSearch(waNumber, data) {
  const {
    locationResult,
    checkInDate,
    checkOutDate,
    adult,
    child,
    infant,
    room,
    budget,
  } = data;

  // Clear state setelah search
  conversationState.clearConversationState(waNumber);

  // Case 1: Kalau ada geoid, pakai searchHotels (untuk region/area)
  if (locationResult.geoid) {
    const searchParams = {
      geoid: locationResult.geoid,
      keyword: locationResult.name,
      dateFrom: checkInDate,
      dateTo: checkOutDate,
      adult: adult,
      child: child,
      infant: infant,
      room: room,
      page: 1,
      limit: 10,
      priceTo: budget || 20000000, // Gunakan budget jika ada, default 20jt
    };

    const result = await hotelService.searchHotels(searchParams);

    if (result.hotels.length === 0) {
      return `Maaf, tidak ada hotel tersedia di ${locationResult.name} untuk tanggal tersebut. 😔\n\nCoba ubah tanggal atau lokasi lain?`;
    }

    // Format response untuk list hotel
    let response = `🏨 HOTEL DI ${locationResult.name.toUpperCase()}\n\n`;
    response += `📅 ${hotelService.formatDate(
      checkInDate
    )} - ${hotelService.formatDate(checkOutDate)}\n`;
    response += `👥 ${adult} dewasa${child > 0 ? ", " + child + " anak" : ""}${
      infant > 0 ? ", " + infant + " bayi" : ""
    }\n`;
    response += `🛏️ ${room} kamar\n`;
    if (budget && budget < 20000000) {
      response += `💰 Budget: Maks ${hotelService.formatPrice(budget)}/malam\n`;
    }
    response += `\n━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Tampilkan 7 hotel pertama
    const hotelsToShow = result.hotels.slice(0, 7);

    hotelsToShow.forEach((hotel, index) => {
      response += `${index + 1}. ${hotel.name}\n`;
      response += `${"⭐".repeat(hotel.class || 0)}\n`;
      response += `💰 ${hotelService.formatPrice(
        hotel.isPromo ? hotel.promoPrice : hotel.price
      )}`;
      if (hotel.isPromo) {
        response += ` ~${hotelService.formatPrice(hotel.price)}~ 🔥`;
      }
      response += `\n`;
      if (hotel.reviewScore && hotel.reviewScore !== "0.0") {
        response += `⭐ Rating: ${hotel.reviewScore}/10\n`;
      }
      response += `📍 ${hotel.address}\n`;

      // Add Google Maps link if lat/lon available
      if (hotel.latitude && hotel.longitude) {
        const mapsLink = hotelService.generateMapsLink(
          hotel.latitude,
          hotel.longitude,
          hotel.name
        );
        if (mapsLink) {
          response += `🗺️ Lokasi: ${mapsLink}\n`;
        }
      }

      response += `\n`;
    });

    response += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    response += `Untuk booking, hubungi Customer Service kami:\n`;
    response += `📞 0822 5500 3535\n`;
    response += `📧 cs@masterdiskon.com\n\n`;
    response += `_Sebutkan nama hotel yang Anda minati untuk mendapatkan penawaran terbaik!_`;

    return {
      text: response,
      apiResponse: result,
    };
  }

  // Case 2: Kalau TIDAK ada geoid (property langsung), pakai getHotelDetail
  else {
    const detailParams = {
      propertyId: locationResult.propertyId,
      keyword: locationResult.name,
      dateFrom: checkInDate,
      dateTo: checkOutDate,
      adult: adult,
      child: child,
      infant: infant,
      room: room,
    };

    const result = await hotelService.getHotelDetail(detailParams);

    if (!result.hotel || result.rooms.length === 0) {
      return `Maaf, ${locationResult.name} tidak tersedia untuk tanggal tersebut. 😔\n\nCoba ubah tanggal atau pilih hotel lain?`;
    }

    // Format response untuk hotel detail + rooms
    let response = `🏨 ${result.hotel.name.toUpperCase()}\n`;
    response += `${"⭐".repeat(result.hotel.class || 0)}\n\n`;
    response += `📅 ${hotelService.formatDate(
      checkInDate
    )} - ${hotelService.formatDate(checkOutDate)}\n`;
    response += `👥 ${adult} dewasa${child > 0 ? ", " + child + " anak" : ""}${
      infant > 0 ? ", " + infant + " bayi" : ""
    }\n`;
    response += `🛏️ ${room} kamar\n`;
    response += `📍 ${result.hotel.address}\n`;

    // Add Google Maps link
    if (result.hotel.latitude && result.hotel.longitude) {
      const mapsLink = hotelService.generateMapsLink(
        result.hotel.latitude,
        result.hotel.longitude,
        result.hotel.name
      );
      if (mapsLink) {
        response += `🗺️ Lokasi: ${mapsLink}\n`;
      }
    }

    response += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    response += `PILIHAN KAMAR:\n\n`;

    // Tampilkan max 5 room options
    result.rooms.forEach((room, index) => {
      response += `${index + 1}. ${room.type}\n`;
      response += `💰 ${hotelService.formatPrice(room.price)}`;
      if (room.promoPrice && room.promoPrice !== room.price) {
        response += ` ~${hotelService.formatPrice(room.promoPrice)}~ 🔥`;
      }
      response += `\n`;
      response += `👥 Maks: ${room.maxOccupancy} orang\n`;
      response += `${
        room.refundIncluded ? "✅ Refundable" : "❌ Non-Refundable"
      }\n\n`;
    });

    response += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    response += `Untuk booking, hubungi Customer Service kami:\n`;
    response += `📞 0822 5500 3535\n`;
    response += `📧 cs@masterdiskon.com\n\n`;
    response += `_Sebutkan tipe kamar yang Anda minati untuk mendapatkan penawaran terbaik!_`;

    return {
      text: response,
      apiResponse: result,
    };
  }
}

module.exports = {
  isHotelRequest,
  handleHotelBooking,
};
