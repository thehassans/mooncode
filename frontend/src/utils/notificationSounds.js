// Notification sound utilities

// Base64-encoded MP3 notification sound (short, subtle ping)
const notificationSoundBase64 = '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';

// Preload notification sound
const notificationSound = new Audio(`data:audio/mp3;base64,${notificationSoundBase64}`);
notificationSound.volume = 0.5; // Set default volume to 50%

/**
 * Play notification sound if enabled
 * @param {Object} options Configuration options
 * @param {boolean} options.enabled Whether sound is enabled (defaults to true)
 * @param {number} options.volume Volume level 0-1 (defaults to 0.5)
 * @returns {Promise<void>} Promise resolves when sound plays or fails
 */
export const playNotificationSound = async (options = {}) => {
  const { enabled = true, volume = 0.5 } = options;
  
  // Skip if disabled
  if (!enabled) return;
  
  try {
    // Check if browser supports audio playback
    if (!notificationSound) return;
    
    // Set volume (0-1)
    notificationSound.volume = Math.max(0, Math.min(1, volume));
    
    // Stop if already playing
    notificationSound.pause();
    notificationSound.currentTime = 0;
    
    // Play sound (promise will resolve when sound begins playing)
    await notificationSound.play();
  } catch (error) {
    console.error('Failed to play notification sound:', error);
    // Silently fail - audio might be blocked by browser policy
  }
};

/**
 * Check if sound notifications are enabled in user preferences
 * @returns {boolean} True if enabled
 */
export const isSoundEnabled = () => {
  try {
    const soundPrefs = localStorage.getItem('notification_sound_enabled');
    return soundPrefs === null ? true : soundPrefs === 'true'; 
  } catch (e) {
    return true; // Default to enabled if storage access fails
  }
};

/**
 * Get notification sound volume from user preferences
 * @returns {number} Volume level 0-1
 */
export const getSoundVolume = () => {
  try {
    const volume = parseFloat(localStorage.getItem('notification_sound_volume') || '0.5');
    return isNaN(volume) ? 0.5 : Math.max(0, Math.min(1, volume));
  } catch (e) {
    return 0.5; // Default to 50% if storage access fails
  }
};

/**
 * Toggle sound notifications on/off
 * @param {boolean} enabled Whether sound should be enabled
 */
export const toggleSoundEnabled = (enabled) => {
  try {
    localStorage.setItem('notification_sound_enabled', enabled ? 'true' : 'false');
  } catch (e) {
    console.error('Failed to save sound preference:', e);
  }
};

/**
 * Set notification sound volume
 * @param {number} volume Volume level 0-1
 */
export const setSoundVolume = (volume) => {
  try {
    localStorage.setItem('notification_sound_volume', Math.max(0, Math.min(1, volume)).toString());
  } catch (e) {
    console.error('Failed to save volume preference:', e);
  }
};

export default {
  playNotificationSound,
  isSoundEnabled,
  getSoundVolume,
  toggleSoundEnabled,
  setSoundVolume
};
