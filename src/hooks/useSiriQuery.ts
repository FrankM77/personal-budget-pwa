import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBudgetStore } from '../stores/budgetStore';
import { parseSiriQuery } from '../services/SiriService';
import type { ParsedTransaction } from '../utils/smartTransactionParser';
import logger from '../utils/logger';

/**
 * Hook that detects a `?query=` search parameter in the URL,
 * parses it using the Siri service (AI + regex fallback),
 * and returns pre-filled transaction data.
 * 
 * Used on the /add-transaction route to support Siri Shortcuts deep links:
 * https://your-app.com/#/add-transaction?query=Grocery+transaction+at+Walmart+for+$33.28
 */
export function useSiriQuery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { envelopes } = useBudgetStore();
  const [parsedData, setParsedData] = useState<ParsedTransaction | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [siriQuery, setSiriQuery] = useState<string | null>(null);

  // Use ref for envelopes to avoid re-triggering effect on every store update
  const envelopesRef = useRef(envelopes);
  envelopesRef.current = envelopes;

  // Extract query param once — only react to actual URL query changes
  const query = searchParams.get('query');

  useEffect(() => {
    logger.log('🎙️ Siri: Hook checking URL params - query:', query);
    
    if (!query || query.trim().length === 0) {
      return;
    }

    logger.log('🎙️ Siri: Found query parameter, parsing:', query);
    setSiriQuery(query);
    setIsParsing(true);

    parseSiriQuery(query, envelopesRef.current)
      .then((result) => {
        logger.log('🎙️ Siri: Parsed result:', result);
        setParsedData(result);
      })
      .catch((error) => {
        logger.error('🎙️ Siri: Parse failed:', error);
        setParsedData(null);
      })
      .finally(() => {
        setIsParsing(false);
      });

    // Clean up the query param from the URL so it doesn't re-trigger
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('query');
    setSearchParams(newParams, { replace: true });
  }, [query]); // Only re-run when the actual query value changes

  const clearParsedData = useCallback(() => {
    setParsedData(null);
    setSiriQuery(null);
  }, []);

  return {
    parsedData,
    isParsing,
    siriQuery,
    clearParsedData,
  };
}
