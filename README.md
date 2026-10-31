# OAuth Setup Guides

A working website that helps developers building AI agents understand how to set up an OAuth app and get it approved for a platform, with a step by step guide, review timeline, and approval checklist.

Live site: https://takehomeapmcomposio-sreekaree-chityalas-projects.vercel.app/
Source: https://github.com/SreeC22/takehomeapmcomposio (private, grant access at submission time if reviewers need it)

## Live use

Open `index.html` for the library, or deploy this folder to Vercel. Search is one merged box: type an app name and press Get guide. If it is in the library, its guide opens directly. If not, it researches live and generates a full guide, once. No login is needed to run it, and no secrets are in this repo.

Live research uses the universal engine in `api/research.js`, deterministic, no LLM, no paid model. It is a multi-stage investigation, not a single keyword search: provider discovery, then independent tracks for authentication, registration, permissions, distribution, approval, and blockers, each with sources and passages where found. It uses two parallel targeted Tavily searches first when TAVILY_API_KEY is set in Vercel, plus one adaptive follow-up search only for missing tracks, links found inside official docs, site navigation, sitemap, generic OAuth patterns, and one backup search, with early stopping when evidence requirements are satisfied and a search budget of 3 Tavily calls and about 12 pages per request. Structured facts include authentication type, console URL, registration requirements, endpoints, scopes, distribution, approval, costs, and blockers. A requirement engine marks each requirement required, optional, conditional, not applicable, or unknown, with condition and evidence. Guides are built from evidence, variable length, not a fixed six steps: API-key, service-account, and personal-token paths do not get OAuth steps, and review is a conditional step for public distribution, not a universal requirement. A quality gate checks provider identity, console relevance, endpoint validity, scope validity, mandatory requirements backed by evidence, approval backed by review evidence, and contradictions, and reports completeness, evidence coverage, source authority, and factual confidence separately. If research fails, the guide is a draft, labeled draft and Unverified, not a full guide. It caches successful guides for 24 hours per Vercel instance, with a force refresh option, and it rate limits per instance at 5 searches per minute and 20 per hour per IP, returning 429 over the limit. Tavily free tier is 1,000 credits per month, so abuse can only burn that credit pool, not a card. No hardcoded provider directory is used. The evaluation harness is `scripts/eval.js`, run with `node scripts/eval.js` for all 20 providers, or with provider names as arguments for a subset. It checks provider host match, auth classification, console not an API reference page, scopes not credential tokens, approval separated as conditional or unknown, evidence coverage, no invented fixed timeline, guide actionability, and latency, and it reports failures, not just passes.

To deploy on Vercel:
1. Import this repo in Vercel.
2. Use the default static site settings, with no build command.
3. Open the deployed link in an incognito window and test search, a guide, and an unfamiliar app.
4. Optional, recommended: set TAVILY_API_KEY in Vercel, Production, Sensitive, then redeploy, so live research uses Tavily first. Without it, the endpoint falls back to site navigation and one backup search.

## What is inside

- `index.html`, `style.css`, `app.js`: the searchable library, guide cards, guide detail view, one merged search box that opens library guides or researches unfamiliar apps live, quick guide view with collapsed evidence, and shareable generated guides.
- `api/research.js`: serverless live research endpoint. It searches for official developer and OAuth docs, fetches candidate pages in parallel batches, extracts registration, redirect, scope, endpoint, and review claims, and returns a full guide plus a research log and timings.
- `readme.html`: rendered README for the deployed site, so reviewers do not depend on a raw .md link.
- `guides.json`: the full guide index, in the same schema used for the human cards and the agent JSON. It is minified, because a single upload argument cannot exceed about 128 KB, and the pretty printed file passed that limit. The site reads minified JSON the same way.
- `guides/<id>.json`: one machine readable guide per platform, for example `guides/github.json`.
- `llms.txt`: a plain text index for agents and crawlers.
- `VERIFICATION-LOG.md`: what was checked, what was corrected, and what could not be verified.
- `SUBMISSION-NOTES.md`: paste-ready notes for the file upload submission.

## Guides included

16 full guides, 0 summaries, checked against docs on 2026-10-31 as noted in each guide. Full means completeness, all sections present. It does not mean verified. Verification is shown separately in each guide, as verificationStatus, and in the guide detail view. No guide claims High confidence, and no guide claims a sign-in, app creation, or provider approval was completed. Notion and Discord each have a single official source. Meta relies on third-party sources only, with its official timeline not confirmed. Airtable is partially verified, official page plus secondary sources, timeline Unknown.

- GitHub, Easy
- Slack, Medium
- Google, Medium to Hard
- Meta, Hard, Low to Medium confidence, timeline not confirmed from an official Meta page
- Microsoft, Medium
- Notion, Easy to Medium
- Salesforce, Medium to Hard
- HubSpot, Medium
- Shopify, Medium
- Zoom, Medium
- Discord, Easy to Medium
- LinkedIn, Medium to Hard
- Airtable, Medium
- Claude, Easy, not an OAuth app, API key only
- ChatGPT, Hard, Sign in with ChatGPT, commercial access is a limited trial
- Composio, Medium, auth config, not a provider OAuth app

## Key decisions

1. Same guide schema for every platform, so difficulty and time are comparable.
2. Setup time is reported separately from approval wait time, because that is the question developers actually ask.
3. Step by step guide, with a separate review timeline and a separate approval checklist, so a developer can see the gate before they submit.
4. Human cards and agent JSON come from the same data, so an agent can call `guides.json` or `guides/<id>.json` and get the same guide a human reads.
5. Live research returns an evidence-built guide with a research log, sources, timings, confidence, separate verificationStatus, per-track evidence, requirements, and a quality gate, not a static template and not a summary. Claims that cannot be verified from a fetched page are marked Unknown, not invented. It does not submit an OAuth app to any provider. If the research endpoint itself fails, the browser fallback is a draft, labeled draft and Unverified, not a full guide. A guide with no usable official evidence is a draft, not a full guide, and that is shown separately from completeness.
6. Generated guides are shareable. The guide data is encoded in the share link and also saved in the browser, so a copied link survives refresh and sharing. Generated steps are clear actions, not raw fragments: register, set redirect, choose scopes, build authorize and token flow, test and review, submit for review, each with an evidence quote from fetched docs where one was found, and authorize and token endpoints listed separately.
7. Managed or custom is the first decision in every guide. Check Composio managed apps first, and go custom only for own branding, custom scopes, dedicated quota, faster polling, a custom instance, or enterprise branding.
8. Agent vs human steps are explicit on every guide, because an agent cannot complete business verification, domain verification, or provider review for a developer.
9. Quick guide view, not long bullets. Steps show a short action, Who and Time chips, and a short Watch out line. Docs evidence is collapsed under Evidence from docs, so it is preserved but does not slow scanning. Step URLs are cleaned of trailing punctuation before linking, so a comma after a URL does not become part of the link and does not 404.
10. Focused slice, not 100 thin guides. Sixteen full guides that can be checked beat a hundred guessed guides. The assignment goal is 100, this submission demonstrates the library and the live generation flow that can expand it.

## Live research, honest version

The merged search calls `api/research.js`. That endpoint searches for official developer and OAuth docs, fetches candidate pages in parallel, and extracts claims only where pages mention OAuth, client ID, redirect, or scopes. It stops once registration, redirect, scopes, and endpoint evidence are collected, and it returns a full guide, a research log with timestamps and failures, sources, timings, and confidence. Extraction is rule-based, not a language model, so quality varies by site, and failures are logged instead of hidden. A generated guide must be checked against official docs before use. Do not treat a generated guide as verified unless its sources confirm the claims.

Measured live on 2026-10-31, uncached server times, all under 5 seconds: Miro 230ms, Asana 506ms, Trello 783ms, Zapier 151ms, ClickUp 842ms, Pipedrive 2,911ms. Cached guides return in about 0ms server time. Fetching latency still varies by provider and instance, and in-memory rate limiting and cache are per instance, not global.

## Style

Inter, loaded from Google Fonts, matching Composio. Uniform white background, with pure blue #0000FF as the main accent for buttons, category tags, hero stats, and section headings. No decorative symbols or emoji clutter, plain functional typography.

## Agents supported

Claude Code, OpenAI Codex, Cursor, GitHub Copilot, Gemini CLI, OpenClaw, OpenCode, Cline, and Grok Build can all read the same guide JSON with no install or plugin from this library, and follow the same steps, timeline, and checklist as a human. This is not a claim of a native Composio plugin or skill install from this library. LinkedIn is a platform in the library, not an agent.

## Limitations

- No account sign-in, app creation, or provider approval was completed for these guides.
- Google and Meta timelines are ranges from guidance found in search results on 2026-10-31, not guarantees for a specific app. Meta timeline in particular was not confirmed from an official Meta page in this check, and is marked as such in the guide.
- Airtable approval and distribution timeline was not confirmed from official Airtable pages in this check, and is marked Unknown in the guide.
- ChatGPT commercial access is a limited trial. Approval wait is Unknown, do not promise a date.
- Claude has no third party OAuth app registration in official docs checked. Its guide is an API key guide, not an OAuth flow.
- Composio itself has no approval. Provider approval, where required, is separate and varies by provider.
- Live research extraction is heuristic. It can miss JavaScript rendered official pages, and it can return Low confidence with Unknowns when no official page can be verified. That is a failure to show, not a guide to use. Pipedrive sources can include a community forum page, which is disclosed as a community source, not an official docs page.
- Token endpoint links are API endpoints, not readable docs pages. They are labeled token endpoint, not official docs, so they do not pretend to be docs.
- Provider consoles, scope names, and review rules change. Check the official docs linked in each guide before a launch decision.
- No credentials, tokens, or client secrets are included anywhere in this repo.

## Verification

See `VERIFICATION-LOG.md` for the sample checked, corrections made, and items that could not be verified. See `SUBMISSION-NOTES.md` for the full round by round record, including the developer trust check, the full guides only upgrade, and the live generation upgrade.
