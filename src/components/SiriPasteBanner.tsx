import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, X } from 'lucide-react';
import { useBudgetStore } from '../stores/budgetStore';
import { parseSiriQuery } from '../services/SiriService';

/**
 * Banner that appears when the PWA is opened from a Siri Shortcut.
 * The Siri Shortcut copies the transaction text to the clipboard,
 * then opens the PWA via webapp:// scheme.
 * 
 * Since clipboard access on iOS requires a user gesture (tap),
 * this banner provides a tap target to read the clipboard,
 * parse the transaction, and navigate to the add transaction form.
 */
export const SiriPasteBanner: React.FC = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();
  const { envelopes } = useBudgetStore();

  // Show banner when PWA comes to foreground (opened from Siri)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Show the banner briefly when app comes to foreground
        // User can tap it if they just used Siri
        setShowBanner(true);
        // Auto-hide after 8 seconds if not tapped
        setTimeout(() => setShowBanner(false), 8000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also show on initial mount (PWA just opened fresh from Siri)
    setShowBanner(true);
    setTimeout(() => setShowBanner(false), 8000);

    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      setIsProcessing(true);
      const clipText = await navigator.clipboard.readText();
      
      if (!clipText || clipText.trim().length === 0) {
        console.log('🎙️ Siri: Clipboard is empty');
        setShowBanner(false);
        setIsProcessing(false);
        return;
      }

      console.log('🎙️ Siri: Read from clipboard:', clipText);

      // Parse the transaction
      const result = await parseSiriQuery(clipText, envelopes);
      console.log('🎙️ Siri: Parsed result:', result);

      // Store in sessionStorage for AddTransactionView to pick up
      sessionStorage.setItem('siriParsedData', JSON.stringify(result));
      sessionStorage.setItem('siriQuery', clipText);

      // Navigate to add transaction
      navigate('/add-transaction');
      setShowBanner(false);
    } catch (error) {
      console.error('🎙️ Siri: Failed to read clipboard or parse:', error);
      setShowBanner(false);
    } finally {
      setIsProcessing(false);
    }
  }, [envelopes, navigate]);

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[70] safe-area-top animate-slide-down">
      <div className="mx-4 mt-2 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={handlePaste}
            disabled={isProcessing}
            className="flex items-center gap-3 flex-1 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">
                {isProcessing ? 'Processing...' : 'Tap to add Siri transaction'}
              </p>
              <p className="text-white/70 text-xs">
                {isProcessing ? 'Parsing your transaction' : 'Paste from clipboard & auto-fill'}
              </p>
            </div>
          </button>
          <button
            onClick={() => setShowBanner(false)}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 ml-2"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};
