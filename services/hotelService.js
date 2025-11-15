// ============================================
// HOTEL SERVICE - Masterdiskon API Integration
// ============================================

const config = require("../config");

const MASTERDISKON_API_BASE = "https://api.masterdiskon.com/v1";

/**
 * Autocomplete pencarian lokasi hotel
 * @param {String} query - Kata kunci pencarian (contoh: "jakarta", "bali")
 * @returns {Object} - { geoid, name, level } atau { propertyId, name, level }
 */
async function searchLocation(query) {
  try {
    console.log(`🔍 Searching location: ${query}`);

    const url = `${MASTERDISKON_API_BASE}/booking/autocomplete?product=hotel&q=${encodeURIComponent(
      query
    )}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();

    if (!result.data || result.data.length === 0) {
      return null;
    }

    // Cari yang ada geoid dulu (region/area)
    const regionResult = result.data.find((item) => item.geoid);

    if (regionResult) {
      console.log(
        `✅ Found region: ${regionResult.name} (geoid: ${regionResult.geoid})`
      );
      return {
        type: "region",
        geoid: regionResult.geoid,
        name: regionResult.fullname || regionResult.name,
        level: regionResult.level,
        address: regionResult.address,
      };
    }

    // Kalau tidak ada geoid, ambil property pertama (hotel langsung)
    const propertyResult = result.data[0];
    console.log(
      `✅ Found property: ${propertyResult.name} (id: ${
        propertyResult.productId || propertyResult.id
      })`
    );

    return {
      type: "property",
      propertyId: propertyResult.productId || propertyResult.id,
      name: propertyResult.fullname || propertyResult.name,
      level: propertyResult.level,
      address: propertyResult.address,
      starRating: propertyResult.starRating,
    };
  } catch (error) {
    console.error("❌ Location search error:", error.message);
    return null;
  }
}

/**
 * Search hotel berdasarkan kriteria
 * @param {Object} params - Parameter pencarian
 * @returns {Object} - { hotels: [], meta: {} }
 */
async function searchHotels(params) {
  try {
    const {
      geoid,
      keyword,
      dateFrom, // format: DD-MM-YYYY
      dateTo, // format: DD-MM-YYYY
      adult = 1,
      child = 0,
      infant = 0,
      room = 1,
      page = 1,
      limit = 15,
      priceTo = 20000000, // Default 20 juta
    } = params;

    console.log(`🏨 Searching hotels in ${keyword}`);
    console.log(`   Dates: ${dateFrom} to ${dateTo}`);
    console.log(`   Guests: ${adult} adult, ${child} child, ${infant} infant`);
    console.log(`   Rooms: ${room}`);
    if (priceTo < 20000000) {
      console.log(`   Max Price: Rp ${priceTo.toLocaleString("id-ID")}`);
    }

    const body = {
      product: "hotel",
      adult: String(adult),
      child: String(child),
      infant: String(infant),
      keyword: keyword,
      from: geoid,
      dateFrom: dateFrom,
      dateTo: dateTo,
      room: String(room),
      childAge: [],
      classFrom: "0",
      classTo: "5",
      showDetail: false,
      pax: {
        room: String(room),
        adult: String(adult),
        child: String(child),
        infant: String(infant),
        childAge: [],
      },
      filter: {
        search: "",
        page: page,
        limit: limit,
        orderType: "",
        priceFrom: 0,
        priceTo: priceTo,
        class: [],
        recomendedOnly: false,
        reviews: [],
      },
    };

    const response = await fetch(
      `${MASTERDISKON_API_BASE}/apitrav/booking/search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success || !result.data || !result.data.productOptions) {
      console.log("⚠️  No hotels found");
      return { hotels: [], meta: { total: 0, page: 1, maxPage: 0 } };
    }

    // Format hotel data untuk response yang lebih ringkas
    const hotels = result.data.productOptions.map((hotel) => {
      // Parse latitude dan longitude (format bisa pakai koma)
      const lat = hotel.detail?.latitude
        ? String(hotel.detail.latitude).replace(",", ".")
        : "";
      const lon = hotel.detail?.longitude
        ? String(hotel.detail.longitude).replace(",", ".")
        : "";

      return {
        id: hotel.id,
        name: hotel.name,
        price: hotel.price,
        promoPrice: hotel.promoPrice,
        isPromo: hotel.isPromo,
        class: hotel.class,
        reviewScore: hotel.reviewScore,
        address: hotel.detail?.address || "",
        city: hotel.detail?.city || "",
        latitude: lat,
        longitude: lon,
        facilities: hotel.facilities,
        image: hotel.image,
      };
    });

    console.log(
      `✅ Found ${hotels.length} hotels (total: ${result.meta?.total || 0})`
    );

    return {
      hotels: hotels,
      meta: result.meta || { total: 0, page: 1, maxPage: 0, limit: limit },
    };
  } catch (error) {
    console.error("❌ Hotel search error:", error.message);
    return { hotels: [], meta: { total: 0, page: 1, maxPage: 0 } };
  }
}

/**
 * Generate Google Maps link dari latitude dan longitude
 */
function generateMapsLink(latitude, longitude, hotelName = "") {
  if (!latitude || !longitude) {
    return "";
  }

  // Clean lat/lon (remove spaces, ensure proper format)
  const lat = String(latitude).trim().replace(",", ".");
  const lon = String(longitude).trim().replace(",", ".");

  // Validate lat/lon
  if (isNaN(parseFloat(lat)) || isNaN(parseFloat(lon))) {
    return "";
  }

  // Google Maps URL format: https://www.google.com/maps/search/?api=1&query=lat,lon
  // Atau dengan label: https://www.google.com/maps/search/?api=1&query=HotelName&query_place_id=...
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

  return mapsUrl;
}

/**
 * Format harga Rupiah
 */
function formatPrice(price) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(price);
}

/**
 * Format tanggal dari DD-MM-YYYY ke format lebih readable
 */
function formatDate(dateStr) {
  const [day, month, year] = dateStr.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Oct",
    "Nov",
    "Des",
  ];
  return `${day} ${months[parseInt(month) - 1]} ${year}`;
}

/**
 * Generate tanggal besok dalam format DD-MM-YYYY
 */
function getTomorrowDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day = String(tomorrow.getDate()).padStart(2, "0");
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const year = tomorrow.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Generate tanggal lusa dalam format DD-MM-YYYY
 */
function getDayAfterTomorrowDate() {
  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);
  const day = String(dayAfter.getDate()).padStart(2, "0");
  const month = String(dayAfter.getMonth() + 1).padStart(2, "0");
  const year = dayAfter.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Parse tanggal dari berbagai format ke DD-MM-YYYY
 * Contoh input: "16 november", "16/11", "16-11-2025", "besok"
 */
function parseDate(dateStr) {
  const lower = dateStr.toLowerCase().trim();

  // Handle kata kunci
  if (lower.includes("besok") || lower.includes("tomorrow")) {
    return getTomorrowDate();
  }

  if (lower.includes("lusa") || lower.includes("day after")) {
    return getDayAfterTomorrowDate();
  }

  if (lower.includes("hari ini") || lower.includes("today")) {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const year = today.getFullYear();
    return `${day}-${month}-${year}`;
  }

  // Try parse DD-MM-YYYY atau DD/MM/YYYY
  const datePattern = /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/;
  const match = dateStr.match(datePattern);
  if (match) {
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    const year = match[3];
    return `${day}-${month}-${year}`;
  }

  // Try parse "DD bulan" (contoh: "16 november")
  const months = {
    januari: "01",
    februari: "02",
    maret: "03",
    april: "04",
    mei: "05",
    juni: "06",
    juli: "07",
    agustus: "08",
    september: "09",
    oktober: "10",
    november: "11",
    desember: "12",
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };

  const monthPattern = /(\d{1,2})\s+(\w+)/;
  const monthMatch = dateStr.toLowerCase().match(monthPattern);
  if (monthMatch) {
    const day = monthMatch[1].padStart(2, "0");
    const monthName = monthMatch[2];
    const month = months[monthName];
    if (month) {
      const year = new Date().getFullYear();
      return `${day}-${month}-${year}`;
    }
  }

  return null;
}

module.exports = {
  searchLocation,
  searchHotels,
  generateMapsLink,
  formatPrice,
  formatDate,
  parseDate,
  getTomorrowDate,
  getDayAfterTomorrowDate,
};
