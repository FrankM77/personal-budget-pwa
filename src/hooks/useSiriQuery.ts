import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBudgetStore } from '../stores/budgetStore';
import { parseSiriQuery } from '../services/SiriService';
import type { ParsedTransaction } from '../utils/smartTransactionParser';

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

  useEffect(() => {
    const query = searchParams.get('query');
    if (!query || query.trim().length === 0) {
      setSiriQuery(null);
      return;
    }

    setSiriQuery(query);
    setIsParsing(true);

    parseSiriQuery(query, envelopes)
      .then((result) => {
        console.log('🎙️ Siri: Parsed result:', result);
        setParsedData(result);
      })
      .catch((error) => {
        console.error('🎙️ Siri: Parse failed:', error);
        setParsedData(null);
      })
      .finally(() => {
        setIsParsing(false);
      });

    // Clean up the query param from the URL so it doesn't re-trigger
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('query');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, envelopes]); // Re-run when query param changes

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
