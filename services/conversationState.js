// ============================================
// CONVERSATION STATE MANAGER
// ============================================

// Store conversation state per user
// Format: { "wa_number": { step, data, lastUpdate } }
const conversationStates = new Map();

// Timeout untuk conversation (5 menit)
const CONVERSATION_TIMEOUT = 5 * 60 * 1000;

/**
 * Get conversation state untuk user
 */
function getConversationState(waNumber) {
  const state = conversationStates.get(waNumber);

  if (!state) {
    return null;
  }

  // Check timeout
  if (Date.now() - state.lastUpdate > CONVERSATION_TIMEOUT) {
    conversationStates.delete(waNumber);
    return null;
  }

  return state;
}

/**
 * Set conversation state untuk user
 */
function setConversationState(waNumber, step, data = {}) {
  conversationStates.set(waNumber, {
    step: step,
    data: data,
    lastUpdate: Date.now(),
  });
}

/**
 * Update conversation state data
 */
function updateConversationData(waNumber, newData) {
  const state = getConversationState(waNumber);
  if (state) {
    state.data = { ...state.data, ...newData };
    state.lastUpdate = Date.now();
    conversationStates.set(waNumber, state);
  }
}

/**
 * Clear conversation state
 */
function clearConversationState(waNumber) {
  conversationStates.delete(waNumber);
}

/**
 * Check apakah user sedang dalam conversation flow
 */
function isInConversation(waNumber) {
  const state = getConversationState(waNumber);
  return state !== null;
}

module.exports = {
  getConversationState,
  setConversationState,
  updateConversationData,
  clearConversationState,
  isInConversation,
};
