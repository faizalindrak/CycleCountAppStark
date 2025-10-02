/**
 * Mobile device detection utility
 * Used to determine if the scan button should be shown
 */

/**
 * Detects if the current device is a mobile device
 * @returns {boolean} true if mobile device, false otherwise
 */
export const isMobileDevice = () => {
  // Check user agent for mobile devices
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    'mobile',
    'android',
    'iphone',
    'ipad',
    'ipod',
    'blackberry',
    'windows phone',
    'opera mini',
    'iemobile'
  ];

  // Check for mobile keywords in user agent
  const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));

  // Check for touch capability (more reliable for modern devices)
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Check screen width (mobile devices typically have smaller screens)
  const isSmallScreen = window.innerWidth <= 768;

  // Consider it mobile if it has touch AND (small screen OR mobile user agent)
  return hasTouchScreen && (isSmallScreen || isMobileUA);
};

/**
 * Detects if the device has camera capability for scanning
 * @returns {boolean} true if camera is likely available, false otherwise
 */
export const hasCameraSupport = () => {
  // Check if getUserMedia is available (camera access)
  return !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia
  );
};

/**
 * Gets device orientation (useful for scan modal positioning)
 * @returns {string} 'portrait', 'landscape', or 'unknown'
 */
export const getDeviceOrientation = () => {
  if (!window.screen || !window.screen.orientation) {
    // Fallback for older browsers
    return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
  }

  const orientation = window.screen.orientation.type;
  if (orientation.includes('portrait')) return 'portrait';
  if (orientation.includes('landscape')) return 'landscape';
  return 'unknown';
};

/**
 * Checks if the page is served over HTTPS (required for camera access)
 * @returns {boolean} true if HTTPS or localhost, false otherwise
 */
export const isSecureContext = () => {
  return location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
};