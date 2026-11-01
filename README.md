# OAuth Setup Guides

A website where a developer can search for an app, get a trustworthy OAuth setup and approval guide, and, when the app is not in the library, watch an agent investigate it and generate a shareable guide live.

Live site: https://takehomeapmcomposio-sreekaree-chityalas-projects.vercel.app/

## Problem and scope

A developer building an AI agent wants their users to connect an app. Before launch, they may need to create an OAuth app with the provider and get it approved. Today that means piecing together docs, guessing how long approval takes, and not knowing what blocks launch.

This site helps a developer understand that path and make progress safely. It does not claim to complete provider sign-in, app creation, or approval for them.

Scope, deliberately focused:

- 16 full library guides, not 100. The assignment asks for a few varied apps plus live generation, not all 100.
- Live generation for unfamiliar apps, from a name or a website URL. A supplied docs URL is fetched directly, in addition to search results.
- No UI redesign in this round, no new library guides, no new features that do not help the core goal.

## Developer-first decision and agent progress (latest update)

The first task in every guide is to determine whether a developer-owned OAuth app is necessary. The website checks **public Composio toolkit documentation** through `/api/managed-auth?app=<provider>` and returns one of three outcomes:

- **Managed available**, supported by an explicit statement on that provider's toolkit page: start with Composio managed OAuth and avoid custom provider registration unless the app needs custom branding, scopes, quota, or configuration. GitHub and Attio are examples verified during this iteration.
- **Bring your own**, supported by an explicit statement that Composio-managed OAuth is not available: follow the provider app-registration guide. Pipedrive is an example verified during this iteration.
- **Unknown**: the docs cannot establish the correct answer; open the linked official directory or use an authenticated toolkit API. Never treat a generic statement about most toolkits as proof for a particular provider.

The public-doc lookup is not the authenticated Composio toolkit API, so Unknown is a valid and intentional result. No Composio API key is exposed.

For unfamiliar apps the deterministic research pipeline now prefers relevant fetched registration instructions over generic provider homepages, separates hands-on task estimates from approval waits, and generates an `agentOutput` record identifying research completed, artifacts prepared, and setup not attempted. When an official developer portal URL is established, the agent attempts a **read-only, credential-free HEAD request** with a bounded timeout. An HTTP response is *not* proof of account access, registration, valid OAuth or approval.

The guide surfaces the next actionable step near the top, shows research artifacts and checklist progress, and offers **Copy agent setup brief**. For sharing, generated guides are reduced to essential evidence and steps, then gzip-compressed into a URL fragment when browser support is available. The recipient does not need this application's database or a user account. Generated source research logs in the share are intentionally condensed, so the original local guide may include more detail.

Test commands: `node scripts/trust-regression.js` and `node scripts/assignment-readiness-regression.js`. These test guide data safety, basic parsing, portable sharing and syntax, not provider OAuth integration end-to-end.

## How to use it

- Search a library app, for example GitHub, and open its guide.
- Search an unfamiliar app, for example Cal.com, or paste its docs URL, for example https://posthog.com/docs/api/oauth, and wait for live research.
- Follow the steps in order, check the blockers, and use the next step at the bottom.
- Copy the share link to share the exact guide, including its status. Generated guides are also saved in the browser only.

Each guide shows, where evidence supports it: difficulty, hands-on setup time, engineering implementation time, published approval wait or Unknown, where to start, prerequisites, configuration steps, review blockers, what an agent can prepare, and what a human must do.

## Managed versus developer-owned OAuth

This decision is shown where evidence supports it, and not claimed where it does not.

- Managed OAuth, through Composio, means Composio stores and refreshes credentials. Use it first when a managed toolkit already covers the platform.
- Developer-owned OAuth means you register your own provider app, with your own client ID, scopes, branding, and quota. Use it when you need your own app name on consent screens, custom scopes, dedicated quota, a custom instance, or no managed auth.
- For library guides, the managed note states which path applies.
- For generated guides, managed coverage for that specific provider was not confirmed in the research run, so the guide says to check the Composio toolkit list before building, rather than claiming managed coverage.

## Three varied examples

- GitHub, straightforward public OAuth, Easy, no approval stage for basic scopes, 30 to 60 minutes. Sources are current GitHub Docs, after a stale Enterprise 2.16 source was replaced with the current scopes page.
- Shopify, private versus public, Medium, custom apps do not need App Store review, public apps for listing do. Written for a developer building an app, not a merchant creating a custom app in their own admin.
- Claude, API key only, Easy, no OAuth app registration, no OAuth approval stage. This is the alternative-path example: do not build OAuth where the provider uses keys.

No sign-in, app creation, or provider approval was completed for any example. All three were checked against official docs only.

## Unfamiliar-app live investigation, this round

- Cal.com, partial OAuth, Low confidence, not presented as full. Portal: https://app.cal.com/settings/developer/oauth. Steps now include creating the client there, waiting for provider review before use, exact redirect matching, and 50 documented scopes starting with EVENT_TYPE_READ and BOOKING_READ. Official docs say the client starts pending, a Cal.com admin reviews it, and the developer gets an email if accepted or rejected, with up to 10 redirect URIs, exact match, and wildcards rejected.
- Baserow, draft, auth unknown, no OAuth steps. Its GitHub SSO page describes signing users into Baserow, not third-party API access, and its API uses database tokens. The previous partial OAuth guide was a regression and is fixed: no scopes, no authorize steps, no placeholder console.
- PostHog, partial OAuth, Low confidence, not presented as full. Live research now finds official docs, after a truncation fix. PostHog uses Client ID Metadata Documents, so pre-registration is not required: the client_id is a URL you host, with redirect URIs that must match exactly. Personal API keys are the own-account alternative. Console is Unknown, not a regional API host.

## How live research works, universal version

Parent-company docs are kept only when the page itself names the product in an OAuth or API context. Near-tie provider matches draft as ambiguous, with a disambiguation next step. OAuth 2.1 is classified separately. MCP applies only when no stronger auth evidence exists and its passage comes from a docs, developer, or MCP path. JS shells get an embedded page-data fallback, and docs sites get an llms.txt fallback.

## How live research works

Deterministic evidence extraction, no language model, no paid inference:

1. Parse the input, preserving the exact hostname, never assuming .com.
2. Search official docs with Tavily, up to 3 calls per request.
3. Fetch provider-host pages only, strip scripts and navigation first, then truncate cleaned text.
4. Extract scopes only from scope sections or scope pages, never from role permission guides, SSO pages, or metadata.
5. Classify each requirement from the sentence that mentions it, with linked negation and modal checks.
6. Distinguish third-party OAuth, sign-in OAuth, registration-free OAuth, API keys, tokens, service accounts, MCP, and SSO.
7. Validate steps against raw text in an independent gate, then apply a three-state outcome: full, partial, or draft.

What was attempted is recorded in the guide log and timings. What was not attempted, sign-in, app creation, or approval, is never implied as completed.

## Tests

- Fixed-document regression: 17/17 new, 12/17 old, on identical captured passages.
- Earlier main adversarial set, 31 providers: 2 full, 18 partial, 11 draft, 0 errors, 0 known critical errors.
- Earlier holdout set, 10 providers, no fixes based on holdout: 0 full, 3 partial, 7 draft, 0 errors, useful coverage only 3 of 10.
- Cal.com, Baserow, PostHog round: all three fixed as described above, with no bad scope, placeholder endpoint, or SSO-derived OAuth step remaining in the generated guides.
- Universal round, main set, 18 providers: 5 partial, 13 draft, 0 full, 0 errors, structural 254/324.
- Universal round, holdout set, 10 providers, no fixes based on holdout: 5 partial, 5 draft, 0 full, 0 errors, structural 139/180.
- Reviewer journey browser test: home to GitHub guide to share link, plus an unfamiliar website URL, reported separately in SUBMISSION-NOTES.md.

Structural harness totals are not factual accuracy rates. Claim-level precision was checked at direction and provider level for actionable guides, not for every step, scope, and endpoint, so no 90 percent claim-level precision is claimed.

## Corrections in this round

- Scopes are now taken only from scope sections or scope pages, including UPPER_SNAKE scopes like EVENT_TYPE_READ. Metadata tokens like og:title and twitter:card, file names like scopes.tsx, and credential tokens are never scopes.
- Endpoint extraction rejects placeholder and example domains, and requires the endpoint host base domain to match the provider domain when known.
- Console candidates from docs body text must be a real portal, on the provider domain, not a placeholder or a bare API host.
- Large JS pages are stripped before truncation, so the article body is not lost behind scripts.
- A supplied website URL is fetched directly, not only searched.
- Registration-free OAuth now carries its own passage as evidence, so it no longer fails validation for lack of a cited passage.
- A zero-source draft now says it is a retrieval failure, what was attempted, and to paste the official docs URL, rather than implying no public docs exist.

## Limitations, plainly

- No guide was tested with a provider sign-in, app creation, or approval.
- Cache and rate limits are per Vercel instance, not global: 5 per minute and 20 per hour per IP per instance, guides cached 24 hours per instance.
- JS-rendered docs, parent-domain docs, and gated enterprise docs often draft honestly rather than guess.
- Combined useful coverage across the earlier main and holdout sets is 23 of 41, not a great majority, and holdout coverage alone is low. In the universal round, combined useful coverage is 10 partial of 28, with 0 full, so the great-majority target is still not met.
- Live research prefers first-party provider documentation when it is available. Some sources can still be misclassified or key details omitted. Partial guides must be checked against official docs before launch.
- Generated guides use compact, optionally gzip-compressed URL fragments without a backend store. Links are smaller than the prior full-JSON hashes but may remain longer than ordinary website URLs, and the shared version contains a condensed log.
- Browser rendering of the newest fields was verified via API response, not a live browser session in every round, except where a browser test is explicitly reported.
- The repository is private, so reviewers need access granted or the source package.

## Final submission QA update (November 1, 2026)

Production smoke tests covered the homepage, README, 16 library JSON guides, Composio managed OAuth lookup, and fresh research for Attio, Cal.com, PostHog, Baserow, Pipedrive and Miro. All tested research requests returned HTTP 200. Generated guides correctly remain Partial or Draft when provider documentation is incomplete; HTTP 200 is not a claim of factual completeness. The browser's copy-share/agent-handoff logic was exercised with a live Attio guide in a JavaScript harness (round-trip preserved its steps and sources), but no actual remote human sign-in or external provider OAuth setup was performed.

Two additional research errors were caught during final QA and corrected: provider SSO setup must not be recommended as third-party OAuth app registration, and documentation about **dynamic client registration** must not become a blanket statement that OAuth registration is unnecessary. Internal engineering handbooks and community posts are excluded from primary customer-app claims when official developer docs are available. Regression checks live in `scripts/registration-qa-regression.js` and `scripts/trust-regression.js`.

Remaining limitations: many unfamiliar providers still yield Unknown for portal, scopes or approval; the deployed website was not exhaustively tested in every browser; generated hash share links can still be lengthy; no provider account was used or approval requested. Repository visibility is a separate submission step.

## Run locally

- Static site: `npx serve .`
- Live research: `vercel dev`, with TAVILY_API_KEY set. Without it, most unfamiliar apps will draft.
- No other environment variables are required, and no secrets are in the submission.

## Files

- `index.html`, `app.js`, `style.css`: site, search, guide detail, share links.
- `guides.json`, `guides/`: 16 library guides.
- `api/research.js`, `api/research-helpers.js`: live research engine.
- `api/managed-auth.js`: public Composio toolkit managed-OAuth verification, with evidence and safe Unknown fallback.
- `scripts/assignment-readiness-regression.js`: compressed-share and syntax regression.
- `SUBMISSION-NOTES.md`: full test results and classifications.
- `VERIFICATION-LOG.md`: verification entries by round.
