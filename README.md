# OAuth Setup Guides

A working website that helps developers building AI agents understand how to set up an OAuth app and get it approved for a platform, with step by step guide, review timeline, and approval checklist.

## Live use

Open `index.html` directly for the library, or deploy this folder to Vercel. Live research uses the serverless endpoint in `api/research.js`. Search is now one merged box: type an app name, press Get guide, library guides open directly, unfamiliar apps are researched live. The endpoint uses Tavily search first when TAVILY_API_KEY is set in Vercel, with site navigation and sitemap fallback when no key is set, and per-IP rate limiting (5 per minute, 20 per hour, 429 over the limit). No login is needed to run it, and no secrets are in this repo.

To deploy on Vercel:
1. Import this repo in Vercel.
2. Use the default static site settings, with no build command.
3. Open the deployed link in an incognito window and test search, a guide, and an unfamiliar app. Optional: set TAVILY_API_KEY in Vercel, Production, Sensitive, then redeploy, so live research uses Tavily first. Without it, the endpoint falls back to site navigation.

## What is inside

- `index.html`, `style.css`, `app.js`: the searchable library, guide cards, guide detail view, one merged search box that opens library guides or researches unfamiliar apps live, and shareable generated guides.
- `api/research.js`: serverless live research endpoint. It searches for official developer and OAuth docs, fetches candidate pages, extracts registration, scope, and review claims, and returns a guide plus a research log.
- `readme.html`: rendered README for the deployed site, so reviewers do not depend on a raw .md link.
- `guides.json`: the full guide index, in the same schema used for the human cards and the agent JSON.
- `guides/<id>.json`: one machine readable guide per platform, for example `guides/github.json`.
- `llms.txt`: a plain text index for agents and crawlers.
- `VERIFICATION-LOG.md`: what was checked, what was corrected, and what could not be verified.
- `SUBMISSION-NOTES.md`: paste-ready notes for the file upload submission.

## Guides included

Full step by step guides, checked against docs on 2026-10-31 as noted in each guide:
- GitHub, Easy
- Slack, Medium
- Google, Medium to Hard
- Meta, Hard
- Airtable, Medium

Summary guides, not verified, that live generation can expand:
- Microsoft, Notion, Salesforce, HubSpot, Shopify, Zoom, Discord, LinkedIn

## Key decisions

1. Same guide schema for every platform, so difficulty and time are comparable.
2. Setup time is reported separately from approval wait time, because that is the question developers actually ask.
3. Step by step guide, with a separate review timeline card and a separate approval checklist card, so a developer can see the gate before they submit.
4. Human cards and agent JSON come from the same data, so an agent can call `guides.json` or `guides/<id>.json` and get the same guide a human reads.
5. Live research returns a guide with a research log, sources, and confidence, not a static template. Claims that cannot be verified from a fetched page are marked Unknown, not invented. It does not submit an OAuth app to any provider.
6. Generated guides are shareable. The guide data is encoded in the share link and also saved in the browser, so a copied link survives refresh and sharing. Generated steps are now clear actions, not raw fragments: register, set redirect, choose scopes, build authorize and token flow, test and review, each with an evidence quote from fetched docs where one was found, and authorize and token endpoints listed separately.
7. Managed or custom is the first decision in every guide. Check Composio managed apps first, and go custom only for own branding, custom scopes, dedicated quota, faster polling, a custom instance, or enterprise branding.
6. Agent vs human steps are explicit on every guide, because an agent cannot complete business verification, domain verification, or provider review for a developer.
8. Focused slice, not 100 thin guides. Five full guides that can be checked beat twelve guessed guides.

## Live research, honest version

The live form calls `api/research.js`. That endpoint searches for official developer and OAuth docs, fetches candidate pages, and extracts claims only where pages mention OAuth, client ID, redirect, or scopes. It returns a guide, a research log with timestamps and failures, sources, and confidence. Extraction is rule-based, not a language model, so quality varies by site, and failures are logged instead of hidden. A generated guide must be checked against official docs before use. Do not treat a generated guide as verified unless its sources confirm the claims.

## Limitations

- No account sign-in, app creation, or provider approval was completed for these guides.
- Google and Meta timelines are ranges from guidance found in search results on 2026-10-31, not guarantees for a specific app. Meta timeline in particular was not confirmed from an official Meta page in this check, and is marked as such in the guide.
- Summary guides are not verified against official docs in this build.
- Live research extraction is heuristic. It can miss JavaScript rendered official pages, and it can return Low confidence with Unknowns when no official page can be verified. That is a failure to show, not a guide to use.
- Provider consoles, scope names, and review rules change. Check the official docs linked in each guide before a launch decision.
- No credentials, tokens, or client secrets are included anywhere in this repo.

## Verification

See `VERIFICATION-LOG.md` for the sample checked, corrections made, and items that could not be verified.
