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
- Third-party guides appear in source lists alongside official docs, and source authority is not shown per source in the guide view. Check partial guides against official docs before launch.
- A generated guide share link is a long encoded URL hash, because the guide data is encoded in the URL with no server store. It works, but it is not a clean URL.
- Browser rendering of the newest fields was verified via API response, not a live browser session in every round, except where a browser test is explicitly reported.
- The repository is private, so reviewers need access granted or the source package.

## Run locally

- Static site: `npx serve .`
- Live research: `vercel dev`, with TAVILY_API_KEY set. Without it, most unfamiliar apps will draft.
- No other environment variables are required, and no secrets are in the submission.

## Files

- `index.html`, `app.js`, `style.css`: site, search, guide detail, share links.
- `guides.json`, `guides/`: 16 library guides.
- `api/research.js`, `api/research-helpers.js`: live research engine.
- `SUBMISSION-NOTES.md`: full test results and classifications.
- `VERIFICATION-LOG.md`: verification entries by round.
