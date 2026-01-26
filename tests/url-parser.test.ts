import { describe, expect, it } from 'vitest';
import { cleanUrl, extractDomain, isValidUrl, parseListingUrl } from '../src/lib/utils/url-parser.js';

describe('parseListingUrl', () => {
  describe('Airbnb URLs', () => {
    it('detects Airbnb room URLs', () => {
      const result = parseListingUrl('https://www.airbnb.com/rooms/12345678');
      expect(result.platform).toBe('airbnb');
      expect(result.listingId).toBe('12345678');
    });

    it('detects Airbnb URLs with country TLD', () => {
      const result = parseListingUrl('https://www.airbnb.es/rooms/12345678');
      expect(result.platform).toBe('airbnb');
    });

    it('detects Airbnb URLs without protocol', () => {
      const result = parseListingUrl('airbnb.com/rooms/12345678');
      expect(result.platform).toBe('airbnb');
      expect(result.url).toBe('https://airbnb.com/rooms/12345678');
    });
  });

  describe('Booking.com URLs', () => {
    it('detects Booking.com hotel URLs', () => {
      const result = parseListingUrl('https://www.booking.com/hotel/es/hotel-example.html');
      expect(result.platform).toBe('booking');
      // Note: listingId includes .html as the regex captures the full slug
      expect(result.listingId).toBe('hotel-example.html');
    });

    it('detects Booking.com URLs with locale prefix', () => {
      const result = parseListingUrl('https://www.booking.com/en-gb/hotel/es/hotel-name.html');
      expect(result.platform).toBe('booking');
    });
  });

  describe('VRBO URLs', () => {
    it('detects VRBO numeric listing URLs', () => {
      const result = parseListingUrl('https://www.vrbo.com/123456');
      expect(result.platform).toBe('vrbo');
      expect(result.listingId).toBe('123456');
    });

    it('detects VRBO by hostname', () => {
      const result = parseListingUrl('https://www.vrbo.com/some-other-path');
      expect(result.platform).toBe('vrbo');
    });
  });

  describe('Expedia URLs', () => {
    it('detects Expedia hotel URLs with hotel ID', () => {
      const result = parseListingUrl('https://www.expedia.com/Hotel-Name.h12345.Hotel-Information');
      expect(result.platform).toBe('expedia');
    });

    it('detects Expedia by hostname', () => {
      const result = parseListingUrl('https://www.expedia.com/hotels');
      expect(result.platform).toBe('expedia');
    });
  });

  describe('Unknown URLs', () => {
    it('returns unknown for unsupported platforms', () => {
      const result = parseListingUrl('https://www.example.com/listing/123');
      expect(result.platform).toBe('unknown');
    });

    it('handles invalid URLs gracefully', () => {
      const result = parseListingUrl('not-a-url');
      expect(result.platform).toBe('unknown');
    });
  });
});

describe('isValidUrl', () => {
  it('returns true for valid URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com')).toBe(true);
    expect(isValidUrl('example.com')).toBe(true);
  });

  it('returns false for invalid URLs', () => {
    expect(isValidUrl('')).toBe(false);
    expect(isValidUrl('   ')).toBe(false);
  });
});

describe('extractDomain', () => {
  it('extracts domain from URL', () => {
    expect(extractDomain('https://www.airbnb.com/rooms/123')).toBe('www.airbnb.com');
    expect(extractDomain('https://booking.com/hotel')).toBe('booking.com');
  });

  it('returns null for invalid URLs', () => {
    expect(extractDomain('')).toBe(null);
  });
});

describe('cleanUrl', () => {
  it('removes tracking parameters', () => {
    const url = 'https://example.com/page?utm_source=google&utm_medium=cpc&id=123';
    const cleaned = cleanUrl(url);
    expect(cleaned).toBe('https://example.com/page?id=123');
  });

  it('preserves non-tracking parameters', () => {
    const url = 'https://example.com/search?q=test&page=2';
    const cleaned = cleanUrl(url);
    expect(cleaned).toContain('q=test');
    expect(cleaned).toContain('page=2');
  });

  it('handles URLs without parameters', () => {
    const url = 'https://example.com/page';
    expect(cleanUrl(url)).toBe('https://example.com/page');
  });
});
