# Vanish Email Client for TypeScript/JavaScript

[![Build & Release](https://github.com/coldpatch/vanish-ts/actions/workflows/release.yml/badge.svg)](https://github.com/coldpatch/vanish-ts/actions/workflows/release.yml)
[![npm version](https://badge.fury.io/js/@vanish-email%2Fclient.svg)](https://www.npmjs.com/package/@vanish-email/client)

A lightweight, zero-dependency client for the [Vanish](https://github.com/coldpatch/vanish) temporary email service API. Works with both TypeScript and JavaScript projects.

## Requirements

- Node.js 18+ or any runtime with Fetch API (Deno, Bun, browsers)
- No external dependencies

## Installation

```bash
npm install @vanish-email/client
# or
yarn add @vanish-email/client
# or
pnpm add @vanish-email/client
# or
bun add @vanish-email/client
```

Or copy `src/vanish.ts` directly into your project.

## Quick Start

### TypeScript

```typescript
import { VanishClient } from '@vanish-email/client';

// Create client (with optional API key)
const client = new VanishClient('https://api.vanish.host', {
	apiKey: 'your-key',
});

// Generate a temporary email address
const email = await client.generateEmail();
console.log(`Your temp email: ${email}`);

// Or with options
const email2 = await client.generateEmail({
	domain: 'vanish.host',
	prefix: 'mytest',
});

// List emails in the mailbox
const result = await client.listEmails(email, { limit: 20 });
console.log(`Total emails: ${result.total}`);

for (const summary of result.data) {
	console.log(`  - ${summary.subject} from ${summary.from}`);
}

// Get full email details
if (result.data.length > 0) {
	const detail = await client.getEmail(result.data[0].id);
	console.log(`HTML: ${detail.html}`);
	console.log(`Text: ${detail.text}`);

	// Download attachments
	for (const att of detail.attachments) {
		const { data, headers } = await client.getAttachment(detail.id, att.id);
		console.log(`Downloaded ${att.name} (${data.byteLength} bytes)`);
	}
}
```

### JavaScript (ESM)

```javascript
import { VanishClient } from '@vanish-email/client';

const client = new VanishClient('https://api.vanish.host', {
	apiKey: 'your-key',
});

const email = await client.generateEmail();
console.log(`Your temp email: ${email}`);
```

### JavaScript (CommonJS)

```javascript
const { VanishClient } = require('@vanish-email/client');

const client = new VanishClient('https://api.vanish.host', {
	apiKey: 'your-key',
});

// Use with async/await or promises
client.generateEmail().then((email) => {
	console.log(`Your temp email: ${email}`);
});
```

## Polling for New Emails

Wait for an email to arrive with the built-in polling utility:

```typescript
// Wait up to 60 seconds for a new email
const newEmail = await client.pollForEmails(
	email,
	60000, // timeout in ms
	5000, // check interval in ms
	0 // initial count to compare against
);

if (newEmail) {
	console.log(`New email received: ${newEmail.subject}`);
} else {
	console.log('No email received within timeout');
}
```

## API Reference

### Client Creation

```typescript
const client = new VanishClient(baseUrl: string, options?: VanishClientOptions);
```

#### Options

| Option    | Type     | Default | Description                     |
| --------- | -------- | ------- | ------------------------------- |
| `apiKey`  | `string` | -       | API key for authentication      |
| `timeout` | `number` | `30000` | Request timeout in milliseconds |

### Methods

#### `getDomains(): Promise<string[]>`

Returns list of available email domains.

#### `generateEmail(options?): Promise<string>`

Generate a unique temporary email address.

```typescript
interface GenerateEmailOptions {
	domain?: string;
	prefix?: string;
}
```

#### `listEmails(address, options?): Promise<PaginatedEmailList>`

List emails for a mailbox with pagination support.

```typescript
interface ListEmailsOptions {
	limit?: number; // 1-100, default 20
	cursor?: string; // Pagination cursor
}
```

#### `getEmail(emailId): Promise<EmailDetail>`

Get full details of a specific email including attachments.

#### `getAttachment(emailId, attachmentId): Promise<{ data: ArrayBuffer, headers: Headers }>`

Download an attachment. Returns content as ArrayBuffer and response headers.

#### `deleteEmail(emailId): Promise<boolean>`

Delete a specific email.

#### `deleteMailbox(address): Promise<number>`

Delete all emails in a mailbox. Returns count of deleted emails.

#### `pollForEmails(address, timeout?, interval?, initialCount?): Promise<EmailSummary | null>`

Poll for new emails until one arrives or timeout.

## Types

### `EmailSummary`

```typescript
interface EmailSummary {
	id: string;
	from: string;
	subject: string;
	textPreview: string;
	receivedAt: Date;
	hasAttachments: boolean;
}
```

### `EmailDetail`

```typescript
interface EmailDetail {
	id: string;
	from: string;
	to: string[];
	subject: string;
	html: string;
	text: string;
	receivedAt: Date;
	hasAttachments: boolean;
	attachments: AttachmentMeta[];
}
```

### `AttachmentMeta`

```typescript
interface AttachmentMeta {
	id: string;
	name: string;
	type: string;
	size: number;
}
```

### `PaginatedEmailList`

```typescript
interface PaginatedEmailList {
	data: EmailSummary[];
	nextCursor: string | null;
	total: number;
}
```

## Error Handling

```typescript
import { VanishClient, VanishError } from '@vanish-email/client';

const client = new VanishClient('https://api.vanish.host');

try {
	const email = await client.getEmail('invalid-id');
} catch (error) {
	if (error instanceof VanishError) {
		console.log(`API Error: ${error.message}`);
		console.log(`Status code: ${error.statusCode}`);
	} else {
		console.log(`Other error: ${error}`);
	}
}
```

## Browser Usage

The library works in browsers with the Fetch API:

```html
<script type="module">
	import { VanishClient } from './dist/vanish.js';

	const client = new VanishClient('https://api.vanish.host');
	const email = await client.generateEmail();
	console.log(email);
</script>
```

## Deno Usage

```typescript
import { VanishClient } from 'npm:@vanish-email/client';

const client = new VanishClient('https://api.vanish.host');
const email = await client.generateEmail();
console.log(email);
```

## Building from Source

```bash
# Install dependencies
npm install

# Build (outputs to dist/)
npm run build
```

This produces:

- `dist/vanish.js` - ESM bundle
- `dist/vanish.cjs` - CommonJS bundle
- `dist/vanish.d.ts` - TypeScript declarations

## Releasing

This library uses GitHub Actions for automated releases to NPM.

### Stable Releases

To publish a stable release:

1. Update the version in `package.json` (optional, can be auto-updated from tag)
2. Create and push a git tag with the `v` prefix:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. The workflow will automatically:
   - Build the library
   - Publish to NPM with the specified version
   - Create a GitHub Release

### Snapshot Releases

Snapshot versions are automatically published for every push to `main` or `develop` branches. These are versioned as:

```
0.0.0-<branch>.<timestamp>.<short-sha>
```

For example: `0.0.0-main.20241229220000.abc1234`

To install a snapshot version:

```bash
# Install the latest main branch snapshot
npm install @vanish-email/client@main

# Install the latest develop branch snapshot
npm install @vanish-email/client@develop
```

You can also manually trigger a snapshot release via the GitHub Actions UI with the "workflow_dispatch" trigger.

### Required Secrets

The following secret must be configured in your GitHub repository:

- `NPM_TOKEN`: An NPM access token with publish permissions for `@vanish-email/client`

## License

MIT
