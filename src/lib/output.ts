import type { CliContext } from '../cli/shared.js';
import type { ContactDossier, SourceInfo } from './concierge-client-types.js';

export function formatDossier(dossier: ContactDossier, ctx: CliContext): string {
  if (ctx.json) {
    return JSON.stringify(dossier, null, 2);
  }

  const { colors } = ctx;
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(colors.highlight('═══════════════════════════════════════════════════════════'));
  lines.push(colors.highlight(`  CONTACT DOSSIER: ${dossier.property.name}`));
  lines.push(colors.highlight('═══════════════════════════════════════════════════════════'));
  lines.push('');

  // Property Info
  lines.push(colors.primary('▸ Property Information'));
  lines.push(`  ${colors.muted('Platform:')} ${dossier.property.platform}`);
  lines.push(`  ${colors.muted('Name:')} ${dossier.property.name}`);

  if (dossier.property.location.city || dossier.property.location.country) {
    const location = [
      dossier.property.location.city,
      dossier.property.location.region,
      dossier.property.location.country,
    ]
      .filter(Boolean)
      .join(', ');
    lines.push(`  ${colors.muted('Location:')} ${location}`);
  }

  if (dossier.property.location.address) {
    lines.push(`  ${colors.muted('Address:')} ${dossier.property.location.address}`);
  }

  if (dossier.property.hostName) {
    lines.push(`  ${colors.muted('Host:')} ${dossier.property.hostName}`);
  }

  lines.push(`  ${colors.muted('Listing:')} ${dossier.property.listingUrl}`);
  lines.push('');

  // Contact Info
  lines.push(colors.primary('▸ Contact Information'));

  const { contacts } = dossier;

  if (contacts.phone.length > 0) {
    lines.push(`  ${colors.success('📞 Phone:')} ${contacts.phone.join(', ')}`);
  }

  if (contacts.email.length > 0) {
    lines.push(`  ${colors.success('📧 Email:')} ${contacts.email.join(', ')}`);
  }

  if (contacts.whatsapp) {
    lines.push(`  ${colors.success('💬 WhatsApp:')} ${contacts.whatsapp}`);
  }

  if (contacts.website) {
    lines.push(`  ${colors.success('🌐 Website:')} ${contacts.website}`);
  }

  if (contacts.instagram) {
    lines.push(`  ${colors.success('📸 Instagram:')} ${contacts.instagram}`);
  }

  if (contacts.facebook) {
    lines.push(`  ${colors.success('📘 Facebook:')} ${contacts.facebook}`);
  }

  if (contacts.googleMapsUrl) {
    lines.push(`  ${colors.success('📍 Google Maps:')} ${contacts.googleMapsUrl}`);
  }

  // Check if any contacts found
  const hasContacts =
    contacts.phone.length > 0 ||
    contacts.email.length > 0 ||
    contacts.whatsapp ||
    contacts.website ||
    contacts.instagram ||
    contacts.facebook;

  if (!hasContacts) {
    lines.push(`  ${colors.warning('No contact information found')}`);
  }

  lines.push('');

  // Sources
  if (dossier.sources.length > 0) {
    lines.push(colors.primary('▸ Sources'));
    for (const source of dossier.sources) {
      const confidence = formatConfidence(source.confidence, colors);
      const url = source.url ? ` - ${colors.muted(source.url)}` : '';
      const note = source.note ? ` (${source.note})` : '';
      lines.push(`  ${confidence} ${source.type}${url}${note}`);
    }
    lines.push('');
  }

  // Footer
  lines.push(colors.muted(`Searched at: ${dossier.searchedAt}`));
  lines.push('');

  return lines.join('\n');
}

function formatConfidence(confidence: SourceInfo['confidence'], colors: CliContext['colors']): string {
  switch (confidence) {
    case 'high':
      return colors.success('●');
    case 'medium':
      return colors.warning('●');
    case 'low':
      return colors.muted('●');
  }
}

export function formatError(error: string, ctx: CliContext): string {
  if (ctx.json) {
    return JSON.stringify({ success: false, error }, null, 2);
  }
  return ctx.colors.error(`Error: ${error}`);
}

export function formatInfo(message: string, ctx: CliContext): string {
  if (ctx.json) {
    return '';
  }
  return ctx.colors.info(message);
}

export function formatVerbose(message: string, ctx: CliContext): string {
  if (ctx.json || !ctx.verbose) {
    return '';
  }
  return ctx.colors.muted(`[verbose] ${message}`);
}
