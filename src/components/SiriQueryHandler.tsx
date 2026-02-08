import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useBudgetStore } from '../stores/budgetStore';
import { parseSiriQuery } from '../services/SiriService';

/**
 * Checks Firestore for a pending Siri query (stored by the Cloud Function
 * when the Siri Shortcut calls "Get Contents of URL").
 * 
 * Uses multiple strategies to detect the query:
 * 1. Polls on mount with retries (handles cold start + Cloud Function latency)
 * 2. Re-checks on visibilitychange/focus (handles already-running PWA)
 */
export const SiriQueryHandler: React.FC = () => {
  const navigate = useNavigate();
  const { envelopes, appSettings } = useBudgetStore();
  const isProcessing = useRef(false);
  const hasNavigated = useRef(false);

  const checkForSiriQuery = useCallback(async () => {
    const siriToken = appSettings?.siriToken;
    if (!siriToken || envelopes.length === 0 || isProcessing.current || hasNavigated.current) return;

    isProcessing.current = true;

    try {
      const docRef = doc(db, 'siriQueries', siriToken);
      const snapshot = await getDoc(docRef);

      if (!snapshot.exists()) return;

      const data = snapshot.data();
      if (!data?.query || data.consumed) return;

      // Check if the query is fresh (less than 2 minutes old)
      const age = Date.now() - (data.timestamp || 0);
      if (age > 120000) {
        await deleteDoc(docRef);
        return;
      }

      console.log('🎙️ Siri: Found pending query in Firestore:', data.query);
      hasNavigated.current = true;

      // Delete immediately so it doesn't trigger again
      await deleteDoc(docRef);

      // Parse the query
      const result = await parseSiriQuery(data.query, envelopes);
      console.log('🎙️ Siri: Parsed result:', result);

      // Store in sessionStorage for AddTransactionView
      sessionStorage.setItem('siriParsedData', JSON.stringify(result));
      sessionStorage.setItem('siriQuery', data.query);

      // Navigate to add transaction
      navigate('/add-transaction');
    } catch (error) {
      console.error('🎙️ Siri: Error checking Firestore:', error);
    } finally {
      isProcessing.current = false;
    }
  }, [envelopes, appSettings?.siriToken, navigate]);

  // Poll on mount: check at 1s, 3s, and 6s
  useEffect(() => {
    if (!appSettings?.siriToken || envelopes.length === 0) return;

    const timers = [
      setTimeout(checkForSiriQuery, 1000),
      setTimeout(checkForSiriQuery, 3000),
      setTimeout(checkForSiriQuery, 6000),
    ];

    return () => timers.forEach(clearTimeout);
  }, [appSettings?.siriToken, envelopes, checkForSiriQuery]);

  // Re-check when app comes back to foreground
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        hasNavigated.current = false;
        setTimeout(checkForSiriQuery, 500);
        setTimeout(checkForSiriQuery, 2000);
        setTimeout(checkForSiriQuery, 5000);
      }
    };

    const handleFocus = () => {
      hasNavigated.current = false;
      setTimeout(checkForSiriQuery, 500);
      setTimeout(checkForSiriQuery, 2000);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkForSiriQuery]);

  return null;
};
