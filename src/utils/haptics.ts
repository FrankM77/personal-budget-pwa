/**
 * Triggers haptic feedback compatible with both Android (via navigator.vibrate)
 * and iOS (via a non-standard checkbox switch hack).
 */
export const triggerHaptic = () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  if (isIOS) {
    // The 'switch' attribute hack works on iOS 18+ for "system click" feel.
    const iosTrigger = document.getElementById('ios-haptic-trigger');
    if (iosTrigger) {
      iosTrigger.click();
    }
  } else {
    // Try standard Vibration API for Android/Desktop
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
  }
};
