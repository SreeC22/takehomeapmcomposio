# OAuth Setup Guides

Live site: https://takehomeapmcomposio-sreekaree-chityalas-projects.vercel.app/
Repo: https://github.com/SreeC22/takehomeapmcomposio

## Problem and target developer

A developer building an AI agent wants users to connect an external app. Before launch, they may need to create an OAuth application, configure redirect URIs and scopes, obtain provider approval, and handle unfamiliar requirements such as restricted scopes, business verification, admin consent, or marketplace review.

This product helps that developer understand the real setup and approval path, make progress on it, and share the result, without being sent down a wrong integration path by a confident but unsupported answer.

## Product approach and focused scope

Searchable library plus live research. A developer searches for an app, opens a guide, or submits an unfamiliar app and watches an agent investigate it live and generate a shareable guide.

Scope is deliberately focused: OAuth app setup and approval guidance, not a general API client, not a managed auth product, and not a 100-app library. A few excellent, evidence-backed guides are better than many incomplete ones. The library has 16 full guides. Live generation covers apps outside the library.

## Features demonstrated

- Searchable guide library, 16 full guides, no summaries.
- Live research for unfamiliar apps, with a merged search box. A library match opens with no API call. An unfamiliar app researches live and generates a full, partial, or draft guide, once, with a Refresh live research button.
- Per-app guide pages: difficulty and why, setup time, engineering implementation time, approval wait, account needed, cost, console, authentication type, can-I-start-now, step by step guide, review timeline, approval checklist, blockers and fixes, agent versus human responsibilities, next step, sources, and research log.
- Three honest research outcomes, shown as badges and verification notes, separate from completeness:
  - Full: a verified path, supported by relevant official sources.
  - Partial: partially verified, useful information confirmed, some requirements still uncertain.
  - Draft: unsupported or ambiguous, provider or workflow could not be reliably established. No fictional OAuth instructions are shown as verified.
- Verification is separate from completeness. No guide claims a sign-in, app creation, or provider approval was completed, because none was. No guide claims High confidence.
- Shareable guides: generated guide data is encoded in the URL hash and saved in localStorage, so a shared link opens the same guide, with its steps, sources, verification status, and next step intact. Guide JSON can be copied for agent use.
- Checklist progress is saved in the browser only. It does not submit anything to a provider.
- Caching is per Vercel instance, in memory, 24 hours for successful full guides only. A cached banner is not shown as newly researched. Force refresh bypasses the cache.
- Rate limiting: 5 searches per minute and 20 per hour per IP per instance, returning 429. Tavily is capped at 200 calls per day per instance, with a budget of 3 calls per research request.

## Technical architecture and agent research flow

Plain HTML, CSS, and JavaScript on the frontend, with a Vercel serverless function at /api/research. No paid AI model, no LLM inference in the research path. The engine is deterministic evidence extraction, not semantic understanding, and uncertain claims are marked Unknown, not guessed.

Research flow, visible in the execution log:
1. Parse the input, preserving the exact domain when a website is given. IP inputs are rejected. No .com is assumed.
2. Provider discovery: two parallel Tavily searches, one for auth and registration, one for review and approval, plus one adaptive follow-up for missing tracks only.
3. Retrieval: parallel batches of up to 4 pages, provider-host only, community and forum hosts and paths excluded, document cache, follow-links, site navigation fallback, and a DuckDuckGo Lite backup, only when evidence is still insufficient. Embedded JSON data files are excluded.
4. Structured facts: scopes only from permission-description pages, endpoints only as full URLs on provider hosts, with OAuth-only token filtering, console scoring that rejects documentation pages as portals, and product grouping that ignores generic doc sections.
5. Requirement engine: a requirement is mandatory only when its cited passage, in its sentence, explicitly supports it, with linked negation and modal proximity. Optional, conditional, and not-applicable language overrides a generic template.
6. Auth systems distinguished: third-party OAuth, provider sign-in OAuth, registration-free OAuth, API key, personal token, service account, MCP authentication, enterprise SSO, and external identity provider for sign-in. These are not interchangeable.
7. Independent validation gate: step prose is re-checked against raw fetched text, not against the generator's own requirement objects. A removed required step makes the guide a draft or partial, not full.
8. Three-state outcome: full only when auth is known, sources are 2 or more, confidence is Medium, key decisions are known, and no validation failure exists. Otherwise partial when some details are confirmed, draft when unsupported or ambiguous.
9. Quality gate: a critical contradiction, wrong auth direction, unsupported mandatory registration or approval, malformed scope, metadata evidence, or a step citing a URL not in endpoints or sources makes the guide a draft or partial, never full.

## Three varied example providers and why they were selected

- GitHub, straightforward public OAuth application. Easy, standard OAuth app registration, callback URL, minimum scopes, test with your own account. Demonstrates the baseline path with no approval stage for basic scopes.
- Shopify, private versus public requirements. Medium, Partner account and dev store, minimum scopes, install and test in a dev store. Custom apps for a single store do not need App Store review. Public apps for listing do. Demonstrates why private and public are different paths, not one template.
- Google, conditional approval with restricted permissions. Medium to Hard, consent screen, scope classification, Testing mode, verification submission. Brand verification typically 2 to 3 business days, sensitive scope verification around 10 business days, restricted scope verification several weeks plus an annual security assessment. All ranges, not guarantees. Demonstrates conditional approval, scope tiers, and why a launch date cannot be promised.
- Claude, alternative authentication method. Easy, API key only, no OAuth app registration, no OAuth approval stage. Demonstrates that the correct answer is sometimes not OAuth at all, and that inventing an OAuth flow would be wrong.

Each example was checked against official documentation on 2026-10-31. No sign-in, app creation, or provider approval was completed for any of them. Corrections made during the audit: Google's verification status was corrected from 2 or more sources to single official source, because only one source URL is listed in its guide. Shopify's guide is written for a developer building an app, not a merchant creating a custom app in their own admin, which is a different path with no Partner account required.

## How to run locally

This is a static site plus one serverless function. No build step is required.

- Serve the project root with any static server, for example: npx serve .
- For live research locally, run the Vercel function with the Vercel CLI, for example: vercel dev, with the environment variables below set.
- Open the site, search for a library app, or submit an unfamiliar app name or website.

## Required environment variables, without values

- TAVILY_API_KEY: Tavily search API key, used for provider discovery. Without it, research falls back to site navigation only, and most unfamiliar apps will draft.
- No other secret is required. No provider client secrets, tokens, or passwords are stored in this repo, and none should be added.

## Key product and engineering decisions

- Prefer an incomplete accurate guide over a complete misleading one. Unknown is a result, not a gap to fill.
- Verification is separate from completeness. Full means a verified path, not that a sign-in was tested.
- Auth direction first. Before deciding a path, determine who is the client, who owns the resource, who is the identity provider, and what the resulting credential accesses.
- Scopes are examples, not a required default. A guide lists documented scope examples and tells the developer to request only the scopes their feature uses.
- Timelines are separated: estimated hands-on setup time, estimated engineering implementation time, published provider approval wait when documented, and unknown wait when not documented. Estimates are labeled as estimates.
- No provider-specific hardcoded exceptions. Fixes are generic engine rules, so they apply to unfamiliar providers.
- No paid AI dependency. The deterministic rule engine is transparent about its limitation: it is not semantic understanding, and complex passages it cannot interpret are marked Unknown.

## What was tested

- Fixed-document regression, scripts/fixed-doc-eval.js: 17 of 17 with the final logic, 12 of 17 with the pre-round logic, on identical captured passages. Improvements: negated start-from-scratch, token endpoint categorization, docs URL rejected as console, doc sections not treated as products, trailing punctuation stripped from cited URLs.
- Main adversarial set, 31 previously untested providers, production endpoint, structural harness plus independent classification against official docs: 2 full, 18 partial, 11 draft, 0 errors, 0 known critical errors in the final audited main sample. Source retrieval succeeded for 25 of 31. Median latency 4,010 ms.
- Holdout set, 10 providers not used while implementing fixes, production endpoint, no code changes based on holdout results: 0 full, 3 partial, 7 draft, 0 errors, structural total 134 of 180, not a factual rate. Actionable guides: Paddle api_key, PropelAuth key_token, Mercury api_key, all direction and provider correct, all partial, not full. Drafts: Replicate, Hugging Face, Paystack, Dubsado, Acuity Scheduling, Turso, Character AI. Source retrieval succeeded for 4 of 10. Useful coverage 3 of 10, abstention 7 of 10, 0 known critical errors in the holdout sample. Character AI drafting is correct abstention, it has no public API. Acuity drafting is parent-domain abstention, its docs live under Squarespace. Replicate, Hugging Face, Paystack, and Dubsado drafting with 0 sources are retrieval failures, not factual errors, and they are the main holdout weakness. Combined main plus holdout: 41 providers, 2 full, 21 partial, 18 draft, 0 errors, 0 known critical errors, useful coverage 23 of 41, source retrieval 29 of 41.
- Library audit, 2026-10-31: all 16 guides open, all per-guide files present, verification statuses checked against listed sources. One correction made, Google, see above.
- Production checks: home page 200, guides.json 200, Figma live research full OAuth Medium with start-now and implementation time fields, shared guide encoding round-trip, checklist persistence in the browser only.

## Known limitations

- No guide has ever been tested with a provider sign-in, app creation, or provider approval. All verification is documentation-based.
- The rule engine is deterministic, not semantic. Complex negation, exceptions, and conditional requirements that do not follow linked patterns are marked Unknown.
- Cache and rate limiting are per Vercel instance, in memory, not global. A cached guide on one instance is not cached on another.
- Static fetch cannot read JS-rendered docs sites well. Some providers, such as Trello and GoCardless in earlier runs, draft because no fetchable official pages were returned.
- Provider docs under a parent domain that does not contain the product name, such as Braintree under developer.paypal.com or Bitbucket under developer.atlassian.com, tend to draft under the strict identity rule. That is honest abstention, but useful coverage is zero for those providers.
- Console Unknown is common by design. A documentation page is never presented as a registration portal, even when that makes the guide less convenient.
- Browser rendering of the newest engine fields was not tested in a live browser session in the final round. API responses containing those fields were verified.
- Rate limiting was not retested in the final round, so it is not claimed as re-verified.
- The repository is private. Reviewers need access granted, or the source package supplied with the submission, which includes the full project, notes, PDF, and eval scripts.
