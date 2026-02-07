import type { Envelope } from '../models/types';

export interface ParsedTransaction {
  amount: number | null;
  merchant: string | null;
  envelope: string | null;
  envelopeId: string | null;
  description: string | null;
  paymentMethodName: string | null;
  type: 'Income' | 'Expense';
  confidence: number; // 0-1 score of parsing confidence
}

/**
 * Regex-based "Smart Parser" for natural language transaction input.
 * Used as a fallback when the AI Cloud Function is unavailable.
 * 
 * Examples of supported input:
 * - "Grocery transaction at Walmart for $33.28"
 * - "Spent 45.00 at Target for groceries"
 * - "$12.50 Starbucks coffee"
 * - "Gas station Shell 55"
 * - "income 2500 paycheck"
 */
export function parseTransactionText(
  text: string,
  envelopes: Envelope[]
): ParsedTransaction {
  const result: ParsedTransaction = {
    amount: null,
    merchant: null,
    envelope: null,
    envelopeId: null,
    description: null,
    paymentMethodName: null,
    type: 'Expense',
    confidence: 0,
  };

  if (!text || text.trim().length === 0) return result;

  const input = text.trim();
  let remaining = input;
  let matchCount = 0;

  // 0. Extract payment method (e.g., "with Chase Amazon" or "using Chase Amazon")
  // We do this early so the remaining text is cleaner for merchant/envelope extraction.
  const paymentMethodMatch = input.match(/\b(?:with|using)\s+(.+)$/i);
  if (paymentMethodMatch && paymentMethodMatch[1]) {
    const candidate = paymentMethodMatch[1].trim();
    if (candidate.length > 0 && candidate.length < 60) {
      result.paymentMethodName = candidate;
      remaining = remaining.replace(paymentMethodMatch[0], ' ').trim();
      matchCount++;
    }
  }

  // 1. Detect transaction type (income vs expense)
  const incomePatterns = /\b(income|earned|received|got paid|paycheck|salary|deposit|refund)\b/i;
  if (incomePatterns.test(input)) {
    result.type = 'Income';
    matchCount++;
  }

  // 2. Extract amount - look for dollar amounts or standalone numbers
  const amountPatterns = [
    /\$\s?(\d{1,}(?:,\d{3})*(?:\.\d{1,2})?)/,         // $33.28, $ 33.28, $1,234.56
    /(\d{1,}(?:,\d{3})*\.\d{1,2})\s*(?:dollars?)?/,    // 33.28, 33.28 dollars
    /\b(\d{1,}(?:,\d{3})*)\s*(?:dollars?|bucks?)\b/i,   // 33 dollars, 33 bucks
    /(?:for|of|spent|paid|cost|was)\s+\$?(\d{1,}(?:,\d{3})*(?:\.\d{1,2})?)/i, // for 33.28, spent $33
  ];

  for (const pattern of amountPatterns) {
    const match = input.match(pattern);
    if (match) {
      const rawAmount = match[1].replace(/,/g, '');
      const parsed = parseFloat(rawAmount);
      if (!isNaN(parsed) && parsed > 0) {
        result.amount = parsed;
        // Remove the matched amount from remaining text for merchant extraction
        remaining = remaining.replace(match[0], ' ').trim();
        matchCount++;
        break;
      }
    }
  }

  // If no pattern matched, try to find any standalone number as a last resort
  if (result.amount === null) {
    const fallbackMatch = input.match(/\b(\d{1,}(?:\.\d{1,2})?)\b/);
    if (fallbackMatch) {
      const parsed = parseFloat(fallbackMatch[1]);
      if (!isNaN(parsed) && parsed > 0 && parsed < 1000000) {
        result.amount = parsed;
        remaining = remaining.replace(fallbackMatch[0], ' ').trim();
        matchCount++;
      }
    }
  }

  // 3. Match envelope - compare words against envelope names (fuzzy match)
  const activeEnvelopes = envelopes.filter(e => e.isActive !== false);
  let bestEnvelopeMatch: { envelope: Envelope; score: number } | null = null;

  for (const envelope of activeEnvelopes) {
    const envName = envelope.name.toLowerCase();
    const inputLower = input.toLowerCase();

    // Exact match
    if (inputLower.includes(envName)) {
      const score = envName.length / inputLower.length;
      if (!bestEnvelopeMatch || score > bestEnvelopeMatch.score) {
        bestEnvelopeMatch = { envelope, score: Math.max(score, 0.8) };
      }
      continue;
    }

    // Partial/fuzzy match - check if any word in input starts with envelope name or vice versa
    const inputWords = inputLower.split(/\s+/);
    const envWords = envName.split(/\s+/);

    for (const envWord of envWords) {
      if (envWord.length < 3) continue; // Skip short words
      for (const inputWord of inputWords) {
        if (inputWord.length < 3) continue;
        // Check if one starts with the other (e.g., "grocery" matches "groceries")
        if (inputWord.startsWith(envWord.slice(0, -1)) || envWord.startsWith(inputWord.slice(0, -1))) {
          const score = Math.min(inputWord.length, envWord.length) / Math.max(inputWord.length, envWord.length);
          if (score >= 0.6 && (!bestEnvelopeMatch || score > bestEnvelopeMatch.score)) {
            bestEnvelopeMatch = { envelope, score };
          }
        }
      }
    }
  }

  if (bestEnvelopeMatch) {
    result.envelope = bestEnvelopeMatch.envelope.name;
    result.envelopeId = bestEnvelopeMatch.envelope.id;
    matchCount++;
    // Remove envelope name from remaining text
    const envNamePattern = new RegExp(bestEnvelopeMatch.envelope.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    remaining = remaining.replace(envNamePattern, ' ').trim();
  }

  // 4. Extract merchant - clean up remaining text
  // Remove common filler words
  const fillerWords = /\b(at|for|from|to|the|a|an|on|in|my|spent|paid|bought|got|transaction|purchase|payment|income|earned|received)\b/gi;
  let merchantText = remaining.replace(fillerWords, ' ').replace(/\s+/g, ' ').trim();
  
  // Remove leading/trailing punctuation
  merchantText = merchantText.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim();

  if (merchantText.length > 0 && merchantText.length < 100) {
    result.merchant = merchantText;
    matchCount++;
  }

  // 5. Set description from original input
  result.description = input;

  // 6. Calculate confidence score
  // Amount found = 0.35, Envelope matched = 0.3, Merchant found = 0.2, Payment method = 0.1, Type detected = 0.05
  result.confidence = 0;
  if (result.amount !== null) result.confidence += 0.35;
  if (result.envelopeId !== null) result.confidence += 0.3;
  if (result.merchant !== null) result.confidence += 0.2;
  if (result.paymentMethodName !== null) result.confidence += 0.1;
  if (matchCount > 0) result.confidence += 0.05;
  result.confidence = Math.min(result.confidence, 1);

  return result;
}
