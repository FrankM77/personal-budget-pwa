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
  const { envelopes, isLoading } = useBudgetStore();
  const [parsedData, setParsedData] = useState<ParsedTransaction | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [siriQuery, setSiriQuery] = useState<string | null>(null);

  // Track which queries we have already processed to prevent infinite loops
  // or re-parsing when envelopes list updates.
  const processedQueryRef = useRef<string | null>(null);

  // Extract query param
  const query = searchParams.get('query');

  useEffect(() => {
    // 1. Exit if no query or if we already processed this exact query
    if (!query || query.trim().length === 0 || query === processedQueryRef.current) {
      return;
    }

    // 2. WAIT for envelopes to load.
    if (isLoading || (envelopes.length === 0)) {
      return;
    }

    // 3. LOCK: Mark this query as processed immediately
    processedQueryRef.current = query;

    setSiriQuery(query);
    setIsParsing(true);
parseSiriQuery(query, envelopes)
  .then((result) => {
    setParsedData(result);
  })
  .catch((error) => {
    logger.error('🎙️ Siri: Parse failed:', error);
    setParsedData(null);
  })
  .finally(() => {
    setIsParsing(false);

    // 4. CLEANUP: Remove query from URL only AFTER parsing attempt is done
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('query');
    setSearchParams(newParams, { replace: true });
  });

  }, [query, envelopes, isLoading, searchParams, setSearchParams]);

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
