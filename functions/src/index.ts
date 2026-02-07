import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { VertexAI } from '@google-cloud/vertexai';

const vertexAI = new VertexAI({
  project: process.env.GCLOUD_PROJECT || 'your-project-id',
  location: 'us-central1',
});

const model = vertexAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
});

export const parseTransaction = onCall(async (request) => {
  // Require authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in to parse transactions.');
  }

  const { text, userEnvelopes } = request.data;

  if (!text || typeof text !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing or invalid "text" field.');
  }

  if (!userEnvelopes || !Array.isArray(userEnvelopes)) {
    throw new HttpsError('invalid-argument', 'Missing or invalid "userEnvelopes" field.');
  }

  try {
    const prompt = `You are a transaction parser for a budgeting app. Parse the following natural language input into structured transaction data.

Input: "${text}"

Available budget envelopes: ${userEnvelopes.join(', ')}

IMPORTANT: Match envelope names using fuzzy matching. Accept common variations:
- "Grocery" or "Groceries" → "Groceries"
- "Restaurant" or "Restaurants" → "Restaurants " (note the space)
- "Gas" → "Gas"
- "Gym" → "Gym Membership"
- "Car" → "Car Maintenance" or "Car Fund"
- "Phone" → "Phone"
- "Clothes" → "Clothing"
- "Hair" → "Hair/Cosmetics"
- "Cleaning" → "Cleaning Supplies"
- "Pet" → "Pet Supplies"
- "Insurance" → "Auto Insurance" or "Umbrella Policy"
- "Doctor" → "Doctor Visits"
- "Misc" → "Misc"
- "Fun" → "Fun Money"
- "Tax" → "Tax Filing"
- "Subscriptions" → "Subscriptions"
- "Mortgage" or "Rent" → "Mortgage/Rent"

If unsure, choose the closest match from the available envelopes or return null.

Return ONLY a valid JSON object with these fields:
- "merchant": string or null (the store/vendor name)
- "amount": number or null (the dollar amount)
- "envelope": string or null (must be one of the available envelopes above, or null if no match)
- "description": string or null (a brief description of the transaction)
- "paymentMethodName": string or null (the payment method name, e.g. "Chase Amazon"; often comes after phrases like "with <payment method>" or "using <payment method>")
- "type": "Income" or "Expense" (default to "Expense" unless the input clearly indicates income like "paycheck", "salary", "refund", etc.)

Examples:
- "Grocery transaction at Walmart for $33.28" → {"merchant":"Walmart","amount":33.28,"envelope":"Groceries","description":"Grocery transaction at Walmart","paymentMethodName":null,"type":"Expense"}
- "Grocery transaction at Walmart for $33.28 using Chase Amazon" → {"merchant":"Walmart","amount":33.28,"envelope":"Groceries","description":"Grocery transaction at Walmart","paymentMethodName":"Chase Amazon","type":"Expense"}
- "Grocery transaction at Walmart for $33.28 with Chase Amazon" → {"merchant":"Walmart","amount":33.28,"envelope":"Groceries","description":"Grocery transaction at Walmart","paymentMethodName":"Chase Amazon","type":"Expense"}
- "Got paid 2500 paycheck" → {"merchant":null,"amount":2500,"envelope":null,"description":"Paycheck","type":"Income"}

Respond with ONLY the JSON object, no markdown, no explanation.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error('Empty response from Gemini');
    }

    // Clean up response (remove markdown code fences if present)
    const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      merchant: parsed.merchant || null,
      amount: typeof parsed.amount === 'number' ? parsed.amount : null,
      envelope: parsed.envelope || null,
      description: parsed.description || null,
      paymentMethodName: parsed.paymentMethodName || null,
      type: parsed.type === 'Income' ? 'Income' : 'Expense',
    };
  } catch (error: any) {
    console.error('parseTransaction error:', error);
    throw new HttpsError('internal', 'Failed to parse transaction: ' + error.message);
  }
});