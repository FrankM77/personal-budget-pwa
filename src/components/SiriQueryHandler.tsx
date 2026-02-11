import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useBudgetStore } from '../stores/budgetStore';
import { parseSiriQuery } from '../services/SiriService';
import logger from '../utils/logger';

/**
 * Checks Firestore for a pending Siri query (stored by the Cloud Function
 * when the Siri Shortcut calls "Get Contents of URL").
 * 
 * Uses a real-time listener (onSnapshot) to detect queries instantly,
 * even if the app is already open/focused.
 */
export const SiriQueryHandler: React.FC = () => {
  const navigate = useNavigate();
  const { envelopes, appSettings } = useBudgetStore();
  const isProcessing = useRef(false);

  useEffect(() => {
    const siriToken = appSettings?.siriToken;
    logger.log('🎙️ Siri: Handler checking - siriToken:', siriToken, 'envelopes count:', envelopes.length);
    if (!siriToken || envelopes.length === 0) {
      logger.log('🎙️ Siri: Handler not ready - missing token or envelopes');
      return;
    }

    // Set up real-time listener
    const docRef = doc(db, 'siriQueries', siriToken);
    logger.log('🎙️ Siri: Setting up Firestore listener for token:', siriToken);
    
    const unsubscribe = onSnapshot(docRef, async (snapshot) => {
      logger.log('🎙️ Siri: Firestore snapshot received, exists:', snapshot.exists());
      if (!snapshot.exists() || isProcessing.current) return;

      const data = snapshot.data();
      if (!data?.query || data.consumed) return;

      // Check if the query is fresh (less than 2 minutes old)
      const age = Date.now() - (data.timestamp || 0);
      if (age > 120000) {
        // Silently clean up stale queries
        try {
          await deleteDoc(docRef);
        } catch (err) {
          logger.error('Failed to cleanup stale Siri query', err);
        }
        return;
      }

      logger.log('🎙️ Siri: Found pending query in Firestore:', data.query);
      isProcessing.current = true;

      try {
        // Delete immediately so it doesn't trigger again
        await deleteDoc(docRef);

        // Parse the query
        const result = await parseSiriQuery(data.query, envelopes);
        logger.log('🎙️ Siri: Parsed result:', result);

        // Store in sessionStorage for AddTransactionView
        sessionStorage.setItem('siriParsedData', JSON.stringify(result));
        sessionStorage.setItem('siriQuery', data.query);

        // Navigate to add transaction with a cache-busting param
        // This ensures React Router treats it as a new navigation even if already on /add-transaction
        navigate(`/add-transaction?siri=${Date.now()}`);

        // Also dispatch a custom event so AddTransactionView can re-read sessionStorage
        // (handles the case where the component is already mounted)
        window.dispatchEvent(new CustomEvent('siri-query-ready'));
      } catch (error) {
        logger.error('🎙️ Siri: Error processing query:', error);
      } finally {
        isProcessing.current = false;
      }
    }, (error) => {
      logger.error('🎙️ Siri: Error listening for queries:', error);
    });

    return () => unsubscribe();
  }, [envelopes, appSettings?.siriToken, navigate]);

  return null;
};
