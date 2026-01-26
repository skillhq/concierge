import type { Command } from 'commander';
import type { CliContext } from '../cli/shared.js';
import { ConciergeClient } from '../lib/concierge-client.js';
import { formatDossier, formatError, formatVerbose } from '../lib/output.js';
import { isValidUrl, parseListingUrl } from '../lib/utils/url-parser.js';

export function findContactCommand(program: Command, getContext: () => CliContext): void {
  program
    .command('find-contact')
    .alias('find')
    .alias('fc')
    .description('Find contact details for an accommodation listing')
    .argument('<url>', 'Listing URL (Airbnb, Booking.com, VRBO, or Expedia)')
    .option('--html <file>', 'Path to saved HTML file (for offline/pre-fetched content)')
    .action(async (url: string, options: { html?: string }) => {
      const ctx = getContext();

      // Validate URL
      if (!isValidUrl(url)) {
        console.log(formatError('Invalid URL provided', ctx));
        process.exit(1);
      }

      // Detect platform
      const parsed = parseListingUrl(url);
      if (parsed.platform === 'unknown') {
        const msg = formatVerbose(
          'URL detected as unknown platform. Supported: Airbnb, Booking.com, VRBO, Expedia',
          ctx,
        );
        if (msg) console.log(msg);
      }

      // Read HTML from file if provided
      let html: string | undefined;
      if (options.html) {
        const fs = await import('node:fs');
        try {
          html = fs.readFileSync(options.html, 'utf-8');
          const msg = formatVerbose(`Loaded HTML from ${options.html}`, ctx);
          if (msg) console.log(msg);
        } catch (error) {
          console.log(formatError(`Failed to read HTML file: ${options.html}`, ctx));
          process.exit(1);
        }
      }

      // Create client and find contacts
      const client = new ConciergeClient();

      const verboseMsg = formatVerbose(`Searching for contacts for: ${url}`, ctx);
      if (verboseMsg) console.log(verboseMsg);

      const result = await client.findContacts(url, {
        html,
        verbose: ctx.verbose,
      });

      if (!result.success) {
        console.log(formatError(result.error, ctx));
        process.exit(1);
      }

      console.log(formatDossier(result.data, ctx));
    });
}
