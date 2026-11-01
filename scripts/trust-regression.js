// Regression tests for developer-facing OAuth evidence extraction.
// Run: node scripts/trust-regression.js
const assert = require('node:assert/strict');
const { extractScopesFromPages, extractEndpoints, stripHtml } = require('../api/research-helpers');

const page = (url, text) => ({ url, text });

const metadataPages = [
  page('https://developers.example.com/reference/admin/scopes',
    'SECTION: Admin scopes\nhold:read\nobject:write'),
  page('https://developers.example.com/guides/public-connections',
    'SECTION: Scope settings\nAI_CHAT REMOVE_BRANDING WEB_MCP props.components favicon.ico twitter:card family:var filter:brightness'),
  page('https://developers.example.com/workers/guides/oauth',
    'SECTION: Scopes\ncalendar.readonly'),
  page('https://developers.example.com/rest-api/guides/authentication',
    'SECTION: Available scopes\nMetadata for page twitter:card is not an API permission.'),
];
assert.deepEqual(extractScopesFromPages(metadataPages), [],
  'Metadata, admin, Workers and configuration tokens must not become third-party OAuth scopes');

const validPages = [
  page('https://cal.example.com/docs/api-reference/v2/oauth',
    'SECTION: Available OAuth scopes\nEVENT_TYPE_READ - Read event types\nBOOKING_WRITE - Create and update bookings'),
  page('https://docs.example.com/rest-api/guides/authentication',
    'SECTION: Scopes\nobjects:read - Read object records\nobjects:write - Write object records'),
];
const scopes = extractScopesFromPages(validPages);
assert(scopes.includes('EVENT_TYPE_READ'), 'Documented UPPER_SNAKE scope should be retained');
assert(scopes.includes('BOOKING_WRITE'), 'Documented UPPER_SNAKE WRITE should be retained');
assert(scopes.includes('objects:read'), 'Documented colon READ should be retained');
assert(scopes.includes('objects:write'), 'Documented colon WRITE should be retained');

const endpoints = extractEndpoints(
  'Send the user to https://api.notion.com/v1/oauth/authorize and exchange at https://api.notion.com/v1/oauth/token.',
  'notion', 'developers.notion.com');
assert(endpoints.includes('https://api.notion.com/v1/oauth/authorize'),
  'OAuth endpoint host must match the provider base domain, not its docs subdomain');
assert(endpoints.includes('https://api.notion.com/v1/oauth/token'),
  'OAuth token endpoint must survive docs-subdomain validation');

const stripped = stripHtml('<html><head><style>.fake{color:red}</style><meta name="twitter:card"></head><body><main><h2>OAuth scopes</h2><p>objects:read - Read objects</p></main></body></html>');
assert(!stripped.includes('color:red'), 'CSS must be excluded before parsing');
assert(stripped.includes('objects:read'), 'Documentation body must be preserved');
console.log('Developer trust regression checks passed');
