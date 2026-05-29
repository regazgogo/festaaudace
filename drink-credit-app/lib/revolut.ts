import crypto from 'crypto';

const apiBase = process.env.REVOLUT_API_BASE_URL || 'https://merchant.revolut.com/api';
const apiKey = process.env.REVOLUT_MERCHANT_API_KEY;
const apiVersion = process.env.REVOLUT_API_VERSION || '2026-04-20';

export async function createRevolutOrder(input: {
  amountCents: number;
  currency?: string;
  description: string;
  redirectUrl: string;
  merchantOrderExtRef: string;
}) {
  if (!apiKey) throw new Error('Missing REVOLUT_MERCHANT_API_KEY');

  const body = {
    amount: input.amountCents,
    currency: input.currency || 'EUR',
    description: input.description,
    redirect_url: input.redirectUrl,
    merchant_order_ext_ref: input.merchantOrderExtRef,
  };

  const res = await fetch(`${apiBase}/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Revolut-Api-Version': apiVersion,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Revolut create order failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return data as { id: string; checkout_url?: string };
}

export function verifyRevolutSignature(params: {
  rawBody: string;
  signatureHeader: string | null;
  timestampHeader: string | null;
  secret: string;
}) {
  const { rawBody, signatureHeader, timestampHeader, secret } = params;
  if (!signatureHeader || !timestampHeader) return false;

  const timestampMs = Date.parse(timestampHeader);
  if (!Number.isFinite(timestampMs)) return false;
  const fiveMinutesMs = 5 * 60 * 1000;
  if (Math.abs(Date.now() - timestampMs) > fiveMinutesMs) return false;

  const payloadToSign = `v1.${timestampHeader}.${rawBody}`;
  const expected =
    'v1=' + crypto.createHmac('sha256', secret).update(payloadToSign).digest('hex');

  return signatureHeader
    .split(',')
    .map((s) => s.trim())
    .some((sig) => timingSafeEqual(sig, expected));
}

function timingSafeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
