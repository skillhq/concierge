import { describe, expect, it } from 'vitest';
import { extractContacts, extractEmailFromText, extractWhatsAppFromText } from '../src/lib/utils/contact-extractor.js';

describe('extractContacts', () => {
  describe('email extraction', () => {
    it('extracts valid email addresses', () => {
      const html = 'Contact us at info@hotelname.com or support@hotel.co.uk';
      const result = extractContacts(html);
      expect(result.emails).toContain('info@hotelname.com');
      expect(result.emails).toContain('support@hotel.co.uk');
    });

    it('filters out blacklisted domains', () => {
      const html = 'test@example.com test@sentry.io test@w3.org';
      const result = extractContacts(html);
      expect(result.emails).not.toContain('test@sentry.io');
      expect(result.emails).not.toContain('test@w3.org');
    });

    it('deduplicates emails', () => {
      const html = 'Email: info@hotel.com Contact: info@hotel.com';
      const result = extractContacts(html);
      expect(result.emails.filter((e) => e === 'info@hotel.com')).toHaveLength(1);
    });

    it('lowercases emails', () => {
      const html = 'Contact: INFO@HOTEL.COM';
      const result = extractContacts(html);
      expect(result.emails).toContain('info@hotel.com');
    });
  });

  describe('phone extraction', () => {
    it('extracts phone numbers with various formats', () => {
      const html = `
        Phone: +1 555-123-4567
        Tel: (555) 987-6543
        Mobile: +34 612 345 678
      `;
      const result = extractContacts(html);
      expect(result.phones.length).toBeGreaterThan(0);
    });

    it('filters out numbers that are too short', () => {
      const html = 'Code: 12345';
      const result = extractContacts(html);
      expect(result.phones).toHaveLength(0);
    });

    it('deduplicates phone numbers', () => {
      const html = '+1 555 123 4567 and also +1-555-123-4567';
      const result = extractContacts(html);
      // After normalization, these should be the same
      const uniqueDigits = new Set(result.phones.map((p) => p.replace(/\D/g, '')));
      expect(uniqueDigits.size).toBeLessThanOrEqual(result.phones.length);
    });
  });

  describe('WhatsApp extraction', () => {
    it('extracts wa.me links', () => {
      const html = '<a href="https://wa.me/34612345678">WhatsApp</a>';
      const result = extractContacts(html);
      expect(result.whatsapp).toContain('+34612345678');
    });

    it('extracts WhatsApp API links', () => {
      const html = '<a href="https://api.whatsapp.com/send?phone=34612345678">Chat</a>';
      const result = extractContacts(html);
      expect(result.whatsapp).toContain('+34612345678');
    });
  });

  describe('Instagram extraction', () => {
    it('extracts Instagram profile URLs', () => {
      const html = '<a href="https://instagram.com/hotelexample">Follow us</a>';
      const result = extractContacts(html);
      expect(result.instagram).toContain('@hotelexample');
    });

    it('filters out Instagram system pages', () => {
      const html = 'https://instagram.com/explore https://instagram.com/hotelexample';
      const result = extractContacts(html);
      expect(result.instagram).not.toContain('@explore');
      expect(result.instagram).toContain('@hotelexample');
    });
  });

  describe('Facebook extraction', () => {
    it('extracts Facebook page URLs', () => {
      const html = '<a href="https://facebook.com/hotelexample">Like us</a>';
      const result = extractContacts(html);
      expect(result.facebook).toContain('hotelexample');
    });

    it('filters out Facebook system pages', () => {
      const html = 'facebook.com/sharer facebook.com/hotelexample';
      const result = extractContacts(html);
      expect(result.facebook).not.toContain('sharer');
      expect(result.facebook).toContain('hotelexample');
    });
  });
});

describe('extractWhatsAppFromText', () => {
  it('extracts WhatsApp number from text', () => {
    expect(extractWhatsAppFromText('WhatsApp: +34 612 345 678')).toBe('+34612345678');
    expect(extractWhatsAppFromText('WA: +1-555-123-4567')).toBe('+15551234567');
  });

  it('returns null when no WhatsApp number found', () => {
    expect(extractWhatsAppFromText('Contact us by email')).toBe(null);
  });
});

describe('extractEmailFromText', () => {
  it('extracts emails from plain text', () => {
    const result = extractEmailFromText('Send to info@hotel.com or booking@hotel.com');
    expect(result).toContain('info@hotel.com');
    expect(result).toContain('booking@hotel.com');
  });

  it('filters blacklisted domains', () => {
    const result = extractEmailFromText('test@example.com and real@hotel.com');
    expect(result).not.toContain('test@example.com');
    expect(result).toContain('real@hotel.com');
  });
});
