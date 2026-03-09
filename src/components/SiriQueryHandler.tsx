import { useEffect, useRef } from 'react';
import { doc, deleteDoc, getDoc, onSnapshot } from 'firebase/firestore';
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
  const { envelopes, appSettings } = useBudgetStore();
  const isProcessing = useRef(false);
  // Use ref for envelopes to avoid re-subscribing on every store update
  const envelopesRef = useRef(envelopes);
  envelopesRef.current = envelopes;

  const siriToken = appSettings?.siriToken;

  useEffect(() => {
    logger.log('🎙️ Siri: Handler checking - siriToken:', siriToken);
    if (!siriToken) {
      logger.log('🎙️ Siri: Handler not ready - missing token');
      return;
    }

    // Set up real-time listener
    const docRef = doc(db, 'siriQueries', siriToken!);
    logger.log('🎙️ Siri: Setting up Firestore listener for token:', siriToken);

    const processQueryData = async (data: any) => {
      if (!data?.query || data.consumed || isProcessing.current) return;

      // Check if the query is fresh (less than 2 minutes old)
      const age = Date.now() - (data.timestamp || 0);
      if (age > 120000) {
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
        await deleteDoc(docRef);

        if (envelopesRef.current.length === 0) {
          logger.log('🎙️ Siri: Waiting for envelopes to load...');
          for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 500));
            if (envelopesRef.current.length > 0) break;
          }
          logger.log('🎙️ Siri: Envelopes ready:', envelopesRef.current.length);
        }

        const result = await parseSiriQuery(data.query, envelopesRef.current);
        logger.log('🎙️ Siri: Parsed result:', result);

        sessionStorage.setItem('siriParsedData', JSON.stringify(result));
        sessionStorage.setItem('siriQuery', data.query);

        window.dispatchEvent(new CustomEvent('open-add-transaction-modal'));
        window.dispatchEvent(new CustomEvent('siri-query-ready'));
      } catch (error) {
        logger.error('🎙️ Siri: Error processing query:', error);
      } finally {
        isProcessing.current = false;
      }
    };

    let pollAttempts = 0;
    const maxPollAttempts = 8;
    const pollForStartupQuery = async () => {
      if (isProcessing.current || pollAttempts >= maxPollAttempts) return;
      pollAttempts += 1;
      try {
        const snapshot = await getDoc(docRef);
        logger.log('🎙️ Siri: Poll check snapshot exists:', snapshot.exists());
        if (snapshot.exists()) {
          await processQueryData(snapshot.data());
        }
      } catch (error) {
        logger.error('🎙️ Siri: Poll check failed:', error);
      }
    };
    
    const unsubscribe = onSnapshot(docRef, async (snapshot) => {
      logger.log('🎙️ Siri: Firestore snapshot received, exists:', snapshot.exists());
      if (!snapshot.exists()) return;
      await processQueryData(snapshot.data());
    }, (error) => {
      logger.error('🎙️ Siri: Error listening for queries:', error);
    });

    pollForStartupQuery();
    const pollTimer = window.setInterval(() => {
      void pollForStartupQuery();
    }, 1000);

    return () => {
      window.clearInterval(pollTimer);
      unsubscribe();
    };
  }, [siriToken]);

  return null;
};
