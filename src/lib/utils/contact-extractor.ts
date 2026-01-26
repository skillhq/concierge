export interface ExtractedContacts {
  emails: string[];
  phones: string[];
  whatsapp: string[];
  instagram: string[];
  facebook: string[];
  websites: string[];
}

// Email pattern - standard email format
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Phone pattern - international format with various separators
const PHONE_PATTERN = /(?:\+|00)?[\d\s\-().]{10,20}/g;

// WhatsApp patterns
const WHATSAPP_PATTERNS = [
  /wa\.me\/(\d+)/gi,
  /api\.whatsapp\.com\/send\?phone=(\d+)/gi,
  /whatsapp(?:\.com)?[^\d]*(\+?\d[\d\s-]{8,})/gi,
];

// Instagram patterns
const INSTAGRAM_PATTERNS = [
  /(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9_.]+)/gi,
  /@([a-zA-Z0-9_.]+)(?:\s+(?:on\s+)?instagram)/gi,
];

// Facebook patterns
const FACEBOOK_PATTERNS = [/(?:facebook\.com|fb\.com)\/([a-zA-Z0-9.]+)/gi, /facebook\.com\/pages\/[^/]+\/(\d+)/gi];

// Common false positives to filter
const EMAIL_BLACKLIST = [
  'example.com',
  'test.com',
  'localhost',
  'domain.com',
  'email.com',
  'yoursite.com',
  'website.com',
  'sentry.io',
  'wixpress.com',
  'w3.org',
];

const INSTAGRAM_BLACKLIST = [
  'instagram',
  'about',
  'explore',
  'p',
  'reel',
  'reels',
  'stories',
  'tv',
  'direct',
  'accounts',
];

const FACEBOOK_BLACKLIST = [
  'facebook',
  'sharer',
  'share',
  'login',
  'groups',
  'events',
  'marketplace',
  'watch',
  'gaming',
  'plugins',
];

export function extractContacts(html: string): ExtractedContacts {
  const result: ExtractedContacts = {
    emails: [],
    phones: [],
    whatsapp: [],
    instagram: [],
    facebook: [],
    websites: [],
  };

  // Extract emails
  const emailMatches = html.match(EMAIL_PATTERN) || [];
  result.emails = [
    ...new Set(
      emailMatches
        .map((e) => e.toLowerCase())
        .filter((e) => !EMAIL_BLACKLIST.some((bl) => e.includes(bl)))
        .filter((e) => !e.includes('png') && !e.includes('jpg') && !e.includes('gif')),
    ),
  ];

  // Extract phones
  const phoneMatches = html.match(PHONE_PATTERN) || [];
  result.phones = [
    ...new Set(
      phoneMatches
        .map((p) => normalizePhone(p))
        .filter((p) => p.length >= 10 && p.length <= 15)
        .filter((p) => !isLikelyNotPhone(p)),
    ),
  ];

  // Extract WhatsApp
  for (const pattern of WHATSAPP_PATTERNS) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const number = match[1].replace(/\D/g, '');
      if (number.length >= 10) {
        result.whatsapp.push(`+${number}`);
      }
    }
  }
  result.whatsapp = [...new Set(result.whatsapp)];

  // Extract Instagram
  for (const pattern of INSTAGRAM_PATTERNS) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const handle = match[1].toLowerCase();
      if (!INSTAGRAM_BLACKLIST.includes(handle) && handle.length > 1 && handle.length < 30) {
        result.instagram.push(`@${handle}`);
      }
    }
  }
  result.instagram = [...new Set(result.instagram)];

  // Extract Facebook
  for (const pattern of FACEBOOK_PATTERNS) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const page = match[1];
      if (!FACEBOOK_BLACKLIST.includes(page.toLowerCase()) && page.length > 1) {
        result.facebook.push(page);
      }
    }
  }
  result.facebook = [...new Set(result.facebook)];

  return result;
}

function normalizePhone(phone: string): string {
  // Remove all non-digit characters except leading +
  const hasPlus = phone.startsWith('+') || phone.startsWith('00');
  const digits = phone.replace(/\D/g, '');

  // Remove leading 00 and treat as +
  const cleanDigits = digits.startsWith('00') ? digits.slice(2) : digits;

  return hasPlus ? `+${cleanDigits}` : cleanDigits;
}

function isLikelyNotPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');

  // All same digits
  if (/^(.)\1+$/.test(digits)) return true;

  // Sequential numbers
  if ('1234567890'.includes(digits) || '0987654321'.includes(digits)) return true;

  // Common non-phone numbers (years, dimensions, etc.)
  if (digits.startsWith('19') || digits.startsWith('20')) {
    if (digits.length === 4) return true; // Years
  }

  return false;
}

export function extractWhatsAppFromText(text: string): string | null {
  // Look for WhatsApp mentions with numbers
  const patterns = [/whatsapp[:\s]+(\+?\d[\d\s-]{8,})/i, /wa[:\s]+(\+?\d[\d\s-]{8,})/i];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const number = match[1].replace(/\D/g, '');
      if (number.length >= 10) {
        return `+${number}`;
      }
    }
  }

  return null;
}

export function extractEmailFromText(text: string): string[] {
  const matches = text.match(EMAIL_PATTERN) || [];
  return [...new Set(matches.map((e) => e.toLowerCase()).filter((e) => !EMAIL_BLACKLIST.some((bl) => e.includes(bl))))];
}
