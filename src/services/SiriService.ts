import { getFunctions, httpsCallable } from 'firebase/functions';
import type { Envelope } from '../models/types';
import { parseTransactionText, type ParsedTransaction } from '../utils/smartTransactionParser';

/**
 * SiriService handles parsing natural language transaction input.
 * 
 * Primary: Calls Firebase Cloud Function with Gemini AI for NLP parsing.
 * Fallback: Uses local regex-based parser if Cloud Function is unavailable.
 */

interface CloudFunctionResponse {
  merchant: string | null;
  amount: number | null;
  envelope: string | null;
  description: string | null;
  paymentMethodName: string | null;
  type: 'Income' | 'Expense';
}

/**
 * Parse a natural language transaction query using the AI Cloud Function.
 * Falls back to local regex parser on failure.
 */
export async function parseWithAI(
  text: string,
  envelopes: Envelope[]
): Promise<ParsedTransaction> {
  const activeEnvelopes = envelopes.filter(e => e.isActive !== false);
  const envelopeNames = activeEnvelopes.map(e => e.name);

  try {
    console.log('🎙️ Siri: Calling Cloud Function to parse:', text);
    
    const functions = getFunctions();
    const parseTransaction = httpsCallable<
      { text: string; userEnvelopes: string[] },
      CloudFunctionResponse
    >(functions, 'parseTransaction');

    const response = await parseTransaction({
      text,
      userEnvelopes: envelopeNames,
    });

    const data = response.data;
    console.log('🎙️ Siri: Cloud Function response:', data);

    // Map the AI-returned envelope name back to an envelope ID
    let envelopeId: string | null = null;
    let envelopeName: string | null = data.envelope;

    if (data.envelope) {
      const matchedEnvelope = activeEnvelopes.find(
        e => e.name.toLowerCase() === data.envelope!.toLowerCase()
      );
      if (matchedEnvelope) {
        envelopeId = matchedEnvelope.id;
        envelopeName = matchedEnvelope.name;
      }
    }

    return {
      amount: data.amount,
      merchant: data.merchant,
      envelope: envelopeName,
      envelopeId,
      description: data.description || text,
      paymentMethodName: data.paymentMethodName || null,
      type: data.type || 'Expense',
      confidence: 0.9, // AI parsing is high confidence
    };
  } catch (error: any) {
    console.warn('🎙️ Siri: Cloud Function failed, falling back to regex parser:', error.message);
    return parseTransactionText(text, envelopes);
  }
}

/**
 * Parse a natural language transaction query using only the local regex parser.
 * Use this when you know the Cloud Function is not available (e.g., offline).
 */
export function parseLocally(
  text: string,
  envelopes: Envelope[]
): ParsedTransaction {
  console.log('🎙️ Siri: Parsing locally with regex:', text);
  return parseTransactionText(text, envelopes);
}

/**
 * Main entry point: Parse a Siri query.
 * Tries AI first, falls back to regex. If offline, skips AI entirely.
 */
export async function parseSiriQuery(
  text: string,
  envelopes: Envelope[]
): Promise<ParsedTransaction> {
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  if (isOffline) {
    console.log('🎙️ Siri: Offline — using local parser');
    return parseLocally(text, envelopes);
  }

  return parseWithAI(text, envelopes);
}
