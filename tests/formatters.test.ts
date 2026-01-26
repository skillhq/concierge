import { describe, expect, it } from 'vitest';
import {
  cleanPropertyName,
  emptyContacts,
  formatFacebookUrl,
  formatGoogleMapsUrl,
  formatInstagramHandle,
  formatInstagramUrl,
  formatPhoneNumber,
  formatPlatformName,
  formatWhatsAppUrl,
  hasAnyContact,
  mergeContacts,
  truncate,
} from '../src/lib/utils/formatters.js';

describe('formatPlatformName', () => {
  it('formats platform names correctly', () => {
    expect(formatPlatformName('airbnb')).toBe('Airbnb');
    expect(formatPlatformName('booking')).toBe('Booking.com');
    expect(formatPlatformName('vrbo')).toBe('VRBO');
    expect(formatPlatformName('expedia')).toBe('Expedia');
    expect(formatPlatformName('unknown')).toBe('Unknown');
  });
});

describe('formatPhoneNumber', () => {
  it('formats US phone numbers', () => {
    expect(formatPhoneNumber('5551234567')).toBe('+1 555-123-4567');
  });

  it('preserves international format', () => {
    expect(formatPhoneNumber('+34612345678')).toBe('+34612345678');
  });

  it('handles longer international numbers', () => {
    const result = formatPhoneNumber('34612345678');
    expect(result).toBe('+34612345678');
  });
});

describe('formatInstagramHandle', () => {
  it('adds @ prefix if missing', () => {
    expect(formatInstagramHandle('hotelexample')).toBe('@hotelexample');
  });

  it('keeps @ prefix if present', () => {
    expect(formatInstagramHandle('@hotelexample')).toBe('@hotelexample');
  });

  it('lowercases the handle', () => {
    expect(formatInstagramHandle('HotelExample')).toBe('@hotelexample');
  });
});

describe('formatInstagramUrl', () => {
  it('creates Instagram URL from handle', () => {
    expect(formatInstagramUrl('@hotelexample')).toBe('https://instagram.com/hotelexample');
    expect(formatInstagramUrl('hotelexample')).toBe('https://instagram.com/hotelexample');
  });
});

describe('formatFacebookUrl', () => {
  it('creates Facebook URL from page name', () => {
    expect(formatFacebookUrl('hotelexample')).toBe('https://facebook.com/hotelexample');
  });

  it('returns full URL if already complete', () => {
    const url = 'https://facebook.com/hotelexample';
    expect(formatFacebookUrl(url)).toBe(url);
  });
});

describe('formatWhatsAppUrl', () => {
  it('creates WhatsApp URL from phone number', () => {
    expect(formatWhatsAppUrl('+34612345678')).toBe('https://wa.me/34612345678');
  });

  it('strips non-digit characters', () => {
    expect(formatWhatsAppUrl('+34 612 345 678')).toBe('https://wa.me/34612345678');
  });
});

describe('formatGoogleMapsUrl', () => {
  it('creates Google Maps search URL', () => {
    const result = formatGoogleMapsUrl('Hotel Example, Madrid, Spain');
    expect(result).toContain('google.com/maps/search');
    expect(result).toContain('Hotel%20Example');
  });
});

describe('mergeContacts', () => {
  it('merges phone arrays', () => {
    const a = {
      phone: ['+1'],
      email: [],
      whatsapp: undefined,
      instagram: undefined,
      facebook: undefined,
      website: undefined,
      googleMapsUrl: undefined,
    };
    const b = {
      phone: ['+2'],
      email: [],
      whatsapp: undefined,
      instagram: undefined,
      facebook: undefined,
      website: undefined,
      googleMapsUrl: undefined,
    };
    const result = mergeContacts(a, b);
    expect(result.phone).toContain('+1');
    expect(result.phone).toContain('+2');
  });

  it('merges email arrays', () => {
    const a = {
      phone: [],
      email: ['a@test.com'],
      whatsapp: undefined,
      instagram: undefined,
      facebook: undefined,
      website: undefined,
      googleMapsUrl: undefined,
    };
    const b = {
      phone: [],
      email: ['b@test.com'],
      whatsapp: undefined,
      instagram: undefined,
      facebook: undefined,
      website: undefined,
      googleMapsUrl: undefined,
    };
    const result = mergeContacts(a, b);
    expect(result.email).toContain('a@test.com');
    expect(result.email).toContain('b@test.com');
  });

  it('prefers non-undefined values from second argument', () => {
    const a = {
      phone: [],
      email: [],
      whatsapp: '+1',
      instagram: undefined,
      facebook: undefined,
      website: 'a.com',
      googleMapsUrl: undefined,
    };
    const b = {
      phone: [],
      email: [],
      whatsapp: '+2',
      instagram: '@hotel',
      facebook: undefined,
      website: undefined,
      googleMapsUrl: undefined,
    };
    const result = mergeContacts(a, b);
    expect(result.whatsapp).toBe('+2');
    expect(result.instagram).toBe('@hotel');
    expect(result.website).toBe('a.com'); // b.website is undefined, so a.website preserved
  });
});

describe('emptyContacts', () => {
  it('returns empty contact info object', () => {
    const result = emptyContacts();
    expect(result.phone).toEqual([]);
    expect(result.email).toEqual([]);
    expect(result.whatsapp).toBeUndefined();
    expect(result.instagram).toBeUndefined();
    expect(result.facebook).toBeUndefined();
    expect(result.website).toBeUndefined();
  });
});

describe('hasAnyContact', () => {
  it('returns false for empty contacts', () => {
    expect(hasAnyContact(emptyContacts())).toBe(false);
  });

  it('returns true if phone exists', () => {
    const contacts = { ...emptyContacts(), phone: ['+1234567890'] };
    expect(hasAnyContact(contacts)).toBe(true);
  });

  it('returns true if email exists', () => {
    const contacts = { ...emptyContacts(), email: ['test@example.com'] };
    expect(hasAnyContact(contacts)).toBe(true);
  });

  it('returns true if instagram exists', () => {
    const contacts = { ...emptyContacts(), instagram: '@hotel' };
    expect(hasAnyContact(contacts)).toBe(true);
  });
});

describe('truncate', () => {
  it('truncates long strings', () => {
    expect(truncate('This is a very long string', 10)).toBe('This is...');
  });

  it('returns short strings unchanged', () => {
    expect(truncate('Short', 10)).toBe('Short');
  });

  it('handles exact length', () => {
    expect(truncate('Exactly10!', 10)).toBe('Exactly10!');
  });
});

describe('cleanPropertyName', () => {
  it('removes extra whitespace', () => {
    expect(cleanPropertyName('Hotel   Example')).toBe('Hotel Example');
  });

  it('removes newlines and tabs', () => {
    expect(cleanPropertyName('Hotel\n\tExample')).toBe('Hotel Example');
  });

  it('trims leading and trailing whitespace', () => {
    expect(cleanPropertyName('  Hotel Example  ')).toBe('Hotel Example');
  });

  it('strips Airbnb suffix', () => {
    expect(cleanPropertyName('Luxury Villa - Airbnb')).toBe('Luxury Villa');
    expect(cleanPropertyName('Cozy Cottage | Airbnb.com')).toBe('Cozy Cottage');
  });

  it('strips Booking.com suffix', () => {
    expect(cleanPropertyName('Grand Hotel - Booking.com')).toBe('Grand Hotel');
  });

  it('strips VRBO suffix', () => {
    expect(cleanPropertyName('Beach House - VRBO')).toBe('Beach House');
  });

  it('strips Expedia suffix', () => {
    expect(cleanPropertyName('City Hotel | Expedia')).toBe('City Hotel');
  });

  it('strips generic rental listing description (Airbnb pattern)', () => {
    const input =
      'Himmapana® Hills - Luxury 3 Bedroom Villa - Villas for Rent in Kammala, Chang Wat Phuket, Thailand - Airbnb';
    expect(cleanPropertyName(input)).toBe('Himmapana® Hills - Luxury 3 Bedroom Villa');
  });

  it('strips Houses for Rent pattern', () => {
    const input = 'Mountain Retreat - Houses for Rent in Aspen, Colorado';
    expect(cleanPropertyName(input)).toBe('Mountain Retreat');
  });

  it('strips Apartments for Rent pattern', () => {
    const input = 'Downtown Loft - Apartments for Rent in NYC, New York';
    expect(cleanPropertyName(input)).toBe('Downtown Loft');
  });

  it('strips Rooms for Rent pattern', () => {
    const input = 'Cozy Room - Rooms for Rent in London, UK';
    expect(cleanPropertyName(input)).toBe('Cozy Room');
  });

  it('handles combined patterns', () => {
    const input = 'Beautiful Villa - Villas for Rent in Barcelona, Spain - Airbnb';
    expect(cleanPropertyName(input)).toBe('Beautiful Villa');
  });
});
