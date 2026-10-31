OAuth Setup Guides - submission notes, paste ready

Live site: https://takehomeapmcomposio-sreekaree-chityalas-projects.vercel.app/
Repo: https://github.com/SreeC22/takehomeapmcomposio
Verified live on 2026-10-31: home page loads without sign-in, 13 guide cards show, searching GitHub filters to the GitHub card, and opening that card shows the step by step guide, review timeline card, and approval checklist card.
Fixes, 2026-10-31: live research endpoint replaces the static live generation template, generated guides are shareable via encoded links and local storage, user text is escaped before HTML insertion, drafts appear in search immediately, a rendered README page and visible GitHub link replace the broken raw README link, a sampled verification report and per-guide execution records are added, Managed or Custom is the first decision in every guide, a Pick your agent section is added for Claude Code, Codex, Cursor, Copilot, Gemini CLI, OpenClaw, OpenCode, Cline, and Grok Build, and Airtable is added as a full guide. Design redesign to docs style in Composio style is still pending approval and is not in this live build, to keep functional fixes separate from unapproved design changes.

What was built:
A searchable website for developers building AI agents. A developer picks an app they want their agent to connect to and gets a full step by step guide guide, with difficulty, active setup time separate from approval wait time, a review timeline card, an approval checklist card, blockers with fixes, agent vs human steps, sources, and uncertainty labels. Guides are also available as structured JSON for agents, from the same data as the human cards.

Demo apps:
- GitHub, Easy, full guide
- Slack, Medium, full guide
- Google, Medium to Hard, full guide
- Meta, Hard, full guide
- Airtable, Medium, full guide
- Microsoft, Notion, Salesforce, HubSpot, Shopify, Zoom, Discord, LinkedIn, summary guides that live generation can expand

How to test live generation:
Open the site, use the live research form, enter an app outside the library, for example Figma, and open the generated guide. The research endpoint searches for official docs, fetches candidate pages, and returns a guide with a research log, sources, and confidence. Claims that cannot be verified are marked Unknown. The research does not submit an OAuth app to any provider.

Key decisions:
- Same guide schema for every platform, so difficulty and time are comparable.
- Setup time separate from approval wait time.
- Step by step guide, plus timeline card and approval checklist card.
- Human cards and agent JSON from the same data.
- Focused slice of four full guides, not 100 thin guides.

Limitations:
- No account sign-in, app creation, or provider approval was completed.
- Google and Meta timelines are ranges, not guarantees. Meta timeline was not confirmed from an official Meta page in this check.
- Summary guides are not verified and must be checked against official docs before use.
- No credentials are included.

Files in this upload:
- index.html, style.css, app.js, guides.json, guides/*.json, llms.txt, README.md, VERIFICATION-LOG.md, SUBMISSION-NOTES.md, and the PDF summary.
- To run locally, open index.html, or deploy the folder to Vercel with default static settings and no build command.


P0 fixes, 2026-10-31, from reviewer score 69/100:
- Website URL inputs are parsed to hostname first. Entering https://figma.com now resolves to Figma, not a guessed httpsfigmacom domain. Regression test: https://figma.com, figma.com, and Figma all return the same Figma guide.
- Research discovery no longer depends only on DuckDuckGo Lite and Brave, which were blocked with 403 and 429 from Vercel. Live research now tries Ecosia search, then DuckDuckGo Lite and Brave, then a verified docs directory for Typeform, Linear, Dropbox, GitHub, Figma, and Airtable, then domain-specific fallbacks. Official docs pages are fetched directly, which works from Vercel.
- Scope filtering now excludes client_id, client_secret, and other credential tokens, and dot scopes must end in read, write, info, metadata, content, member, delete, create, or update, so domain names and file names are not reported as scopes.
- Generated guides now include setup time and difficulty reasoning from retrieved docs, with evidence snippets for registration, redirect, and review, and endpoints found in fetched pages. Unknowns stay Unknown.
- Guide detail and home sections now use bullet lists for easy reading.
- Use the short alias link for review, not an old deployment URL. The alias always points to the latest production deployment, while old deployment URLs are frozen at their earlier version.


Unfamiliar provider live research, 2026-10-31, reviewer score 73/100 follow-up:
- Discovery no longer depends only on search engines, which return 403 and 429 from Vercel. Live research now does site navigation first for unfamiliar providers: provider homepage, developer and docs links, sitemap, then a verified docs directory as fallback, then domain guesses, with an AllOrigins proxy retry when direct fetch fails with 403 or 429. Search results and fetched pages are filtered to provider-specific hosts only, so generic OAuth tutorials are not reported as provider sources.
- Full hostname is preserved, including TLD, for example tally.so is not assumed to be tally.com.
- Approval detection now requires specific phrases such as app review, app approval, submit for review, or public app, not generic verification, which could mean token verification.
- Snippets are now cut at word boundaries, not mid-word.
- Setup times are labeled as estimates when no published provider time was found, with the basis stated, not presented as a cited fact.
- Live search, 2026-10-31: main search and live research form now search the library and saved generated guides live as you type, and only generate once for an app not already found. Submitting an app already in the library opens the existing guide with no new API call. A Generate fresh anyway button forces a new research run.
- Verified live on the alias link, 2026-10-31: Miro Medium, 3 official sources, scopes boards:read, boards:write; Asana Medium, 3 official sources, scopes attachments:read, custom_fields:read, and more; Monday.com Medium, 3 sources including developer.monday.com OAuth docs, scopes boards:read, boards:write, account:read, and more; Pipedrive Medium, 3 sources including developers.pipedrive.com Oauth docs, scopes not found in fetched pages, setup Unknown, not invented; Typeform Medium, 3 official sources, scopes forms:read, responses:read, and more; Figma Medium to Hard, 3 official sources, scopes file_content:read, current_user:read, and more; tally.so Low, sources developers.tally.so, no valid OAuth scopes found, with an explicit blocker that Tally.so docs mention API keys and OAuth support must be confirmed before building an OAuth flow.
- Pipedrive live research took about 50 seconds in one run, which is slow, but it completed with sources. Library apps now skip generation entirely, so this latency only affects first-time unfamiliar apps.


Style update, 2026-10-31: clean Composio-inspired styling, visual pattern only, no Composio content, logos, or product copy copied. Near-black hero #0A0A0A, white body, pure blue #0000FF used sparingly for the headline block and links, uppercase mono labels, sharp rectangular buttons, thin light gray borders, rounded cards, generous whitespace, no gradients or shadows. Guide outputs kept clean: bullet lists, HTML entities decoded, snippets cut at the first sentence, no messy nav lists in steps where possible.


Final three items, 2026-10-31:
- GitHub synced with production: unified merged search, Tavily integration, rate limiting, clean Composio-inspired style, and improved generated steps are all pushed to main, so a reviewer cloning the repo gets the exact version seen online.
- Generated instructions improved: steps are now clear actions (open the console, create the app, add the exact redirect URI, request only listed scopes, send the user to the authorize endpoint then exchange at the token endpoint, test with a real account), with evidence quotes sentence-cut from fetched docs, junk snippets skipped, and authorize vs token endpoints listed separately. Where evidence is missing, the step says what to do next instead of inventing a fragment.
- Tavily live: TAVILY_API_KEY is set in Vercel, Production, Sensitive. Live ClickUp test showed Tavily found_3 provider-specific URLs, official ClickUp docs, Medium confidence. Live Asana retest showed 3 official sources and 14 scopes in 13.8 seconds, after a first flaky run with 0 sources in 94.7 seconds, so fetching can still vary by run.
- Rate limiting: 5 searches per minute per IP, 20 per hour per IP, 429 over the limit, no Tavily call on a limited request, per-instance Tavily cap 200 per day. Note: Vercel splits parallel requests across instances, so the in-memory limit is per-instance, not a true global limit.

## Latency optimization, 2026-10-31

- Tavily first: when Tavily returns provider URLs, Ecosia, DuckDuckGo, and Brave are no longer tried. DuckDuckGo Lite is only a last resort, direct only, no proxy, and only when Tavily returned fewer than 3 provider URLs.
- Official docs ranking: Tavily URLs are ranked so developers, developer, and docs hosts come first. Community, forum, and blog URLs are excluded from the primary list, so Miro, Asana, and Zapier guides now cite official docs only, not forum pages.
- Parallel retrieval: top 4 docs are fetched in parallel with 3 second timeouts, instead of sequentially with proxy retries. Proxy retries are now only for Tavily URLs, with a 5 second cap, not for guessed patterns or search engines.
- Early stopping: fetching stops once sources, client ID, redirect, scopes, and endpoints are present. Site navigation (base, developers, developer, docs hosts in parallel) and generic OAuth patterns run only when evidence is still incomplete.
- Reduced waste: no speculative .md URLs for every candidate, only for short JS shells. No sitemap crawling for every host, only base and developers hosts, in parallel, and only as a fallback.
- Caching: successful guides (Medium confidence, at least 2 sources) are cached per instance for 24 hours. A cached hit returns before rate limiting, with cached true and 0ms timings. Force refresh is available as ?refresh=1 on the API and as Refresh live research in a generated guide detail.
- Progress feedback: the search status now shows Searching for official docs, then Reading documentation, then Generating guide, and on completion shows total, search, and docs times, plus cached when applicable.
- Observability: the API returns timings with searchMs, retrievalMs, extractionMs, totalMs, and cached, and logs the same breakdown. The guide also carries timings.
- Measured live on deployment dpl_3q2KijTjVbaT1sQFKSuurqmhtKWa, 2026-10-31, with refresh=1, so these are uncached except the last row:
  - Miro: server 230ms, wall 1.0s, Medium, Medium to Hard, 3 official sources
  - Asana: server 506ms, wall 0.9s, Medium, Medium to Hard, 6 official sources
  - Trello: server 783ms, wall 1.5s, Low, Medium to Hard, 6 official sources, scopes not colon tokens so confidence stays Low, honestly
  - Zapier: server 151ms, wall 0.6s, Medium, Medium to Hard, 3 official sources
  - ClickUp: server 842ms, wall 1.3s, Medium, Unknown difficulty, 4 official sources, scopes Unknown as before
  - Miro cached repeat: server 0ms, wall 0.48s, cached true
- All uncached results are under the 5 second typical target in this run. Times will vary with provider docs speed and Tavily, and per-instance caching and rate limiting are not global across Vercel instances, as noted before.
- Guide sharing is unchanged: encode and decode of the guide JSON are the same, timings is just an extra field in the encoded guide.

## Scope extraction fix, same day

- Zapier scopes were polluted by CSS tokens from styled docs pages, for example display:fallback and align:middle. Fixed by preferring colon and dot tokens that appear near a scope mention, which covers lists, tables, and JSON scope fields like Miro boards:write, and by filtering CSS selectors and pseudo-classes such as hover, not, last, and first.
- Verified live on deployment dpl_HVvAYm6ypbtJkD4vVuDK5uQYRQW4: Zapier scopes are now zap:write, zap:update, zap:delete, zap:pause, zap:all, zap:account, zap:runs, action:run, authentication:write, connection:read, connection:write, connection:delete, mcp:run, with no CSS tokens. Miro scopes are back to boards:write, boards:read. Asana scopes are unchanged and clean. Zapier server time in that run was 493ms, Miro 111ms, Asana 463ms.

## UI refresh, 2026-10-31

- Font: Inter is now loaded from Google Fonts on every load, weights 400, 500, 600, 700, and 800, matching the font Composio uses on composio.dev. Previously Inter was only first in the local font stack, so it fell back to system fonts when Inter was not installed. Mono labels stay in the system mono stack, as on Composio.
- Prettier, same content: a top nav bar, a pill eyebrow, a hero stats row (13 library guides, 5 full guides, live research), a search card that sits over the hero with a soft shadow, platform cards with a hover lift and a View guide line, and guide detail and agent sections as pale rounded cards. No guide text, search flow, or sharing code changed.
- Live deployment dpl_8MAXViF1STrfNAjpE3HTXZDPX2w4, verified on the alias: index loads the Inter stylesheet, style.css is the new 5020 byte file, app.js contains View guide, and guides.json loads.

## Uniform background and category tags, 2026-10-31

- Background is now uniform white across the whole page. The black hero was removed, so the header, body, cards, search card, and detail all sit on white, with borders and the blue accent doing the separation work instead of switching backgrounds.
- Category is now a tag, not plain text. Platform cards and guide details show the category as a badge, so Salesforce, HubSpot, and Shopify show a Business tag, GitHub shows Developer tools, and so on.
- Live deployment dpl_F67f2zxrbof2PPnyobC2oUUYLNxw, verified on the alias: hero background is white, and app.js renders the category badge.

## Blue accent upgrade, 2026-10-31

- Blue is now the main accent, not just links. Primary buttons are pure blue, turning black on hover. The eyebrow pill is blue text on a blue tint, hero stat numbers are blue, and the brand word Guides is blue.
- Category tags, including Business, are blue tint tags. Search card has a blue tint border and shadow, platform cards get a blue border and blue tint shadow on hover, and section headings get a short blue bar underneath.
- Uniform white background and Inter font are unchanged.
- Live deployment dpl_4jrDsiBTwyLhCLV6AJoiB5azpcLF, verified on the alias: blue buttons, blue category tags, and blue hero stat numbers are in the live style and script.

## Quick guide view, 2026-10-31

- Guide steps are now short numbered cards, not long bullets. Each step shows its title, one short action line, Who and Time as small chips, and a short Watch out line.
- Long docs quotes are no longer in the main view. They sit behind a collapsed Evidence from docs tap on each step, so the evidence and citations are still there without making the guide hard to scan.
- Raw URLs in steps are now a short official docs link instead of a long address wrapping across lines on mobile. The full source list is still at the bottom of the guide.
- The difficulty explanation under the guide title is now small muted text, so the steps start sooner.
- No guide content was deleted. Library guides were already short, so the main change is for generated guides like Miro, where evidence quotes made steps wordy.
- Live deployment dpl_8Nwfsa7gvvX7Kmr23v2UYwejUWMK, verified on the alias: step cards, Evidence from docs, and official docs links are in the live script and style.
