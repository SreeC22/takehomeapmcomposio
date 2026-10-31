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

## Official docs link fix, 2026-10-31

- Root cause: step text puts a comma after a URL, for example "open https://developers.figma.com/docs/rest-api/oauth-apps/, sign in". The link builder was including that comma inside the link, so the browser opened .../oauth-apps/, and Figma returned Page Not Found. The same comma broke the Miro step 1 link.
- Fix: the link builder is now platform agnostic. It strips trailing punctuation (comma, period, semicolon, and similar) from every URL before making the link, and puts that punctuation back outside the link. It also labels endpoints correctly: authorize endpoint and token endpoint, instead of calling every link official docs.
- Clean URLs verified: Figma https://developers.figma.com/docs/rest-api/oauth-apps/ returns 200, Miro https://developers.miro.com/docs/add-permission-scopes-to-your-app returns 200, while the same URLs with a trailing comma returned 404.
- Live deployment dpl_FswUXfUEuLNHgVhfqLdwKV9U2Z96, verified on the alias: the new link builder is in the live script.

## Claude, ChatGPT, and Composio guides, plus developer trust check, 2026-10-31

- Library is now 16 guides, 8 full. New full guides: Claude, ChatGPT, and Composio, all Medium confidence, short steps, no em dashes.
- Developer trust check, done before publishing these three, as a developer arriving cold would check them:
  - Step 1 must open a real official page. All new sources returned 200, including Anthropic get-api-key, OpenAI Sign in with ChatGPT, OpenAI discovery, and Composio custom auth configs.
  - Auth model must be real, not invented OAuth. Claude: no third party OAuth app, API key only, sk-ant-, ANTHROPIC_API_KEY, shown once. ChatGPT: real OAuth 2.0 plus OpenID Connect, but commercial access is a limited trial, so approval is Unknown, not a promised date. Composio: not a provider OAuth app, it is an auth config, managed first, custom only with the exact callback https://backend.composio.dev/api/v3/toolkits/auth/callback.
  - What was not tested is stated. None of the three guides claims a sign-in, key creation, client approval, or auth config creation was completed. NotVerified lists layout, pricing, and specific app availability.
  - Existing library, same check: GitHub, Slack, and Google are the most trustable full guides, official sources 200, approval as ranges, no High confidence claimed. Airtable is Medium with a timeline explicitly not confirmed. Meta is the weakest full guide, third party sources only, timeline not confirmed, confidence Low to Medium. The 8 summary guides are labeled summary, Low, all details not verified, and are starting cards only, not verified guides. Airtable console https://airtable.com/create/oauth returned 403 to curl, likely a bot block, so it is not claimed as a curl verified link for a human browser.
  - Trust fixes applied to the new guides: each guide states its real auth model in its first line, so a developer does not follow an OAuth flow for Claude, or expect open ChatGPT client access, or expect Composio itself to approve a provider app.
- Live deployment dpl_F74FmcWA2punsR9yZMtxhMwHzMCx, verified on the alias: guides.json lists all 16, and guides/claude.json, guides/chatgpt.json, and guides/composio.json all return 200.

## Full guides only, library and live generation, 2026-10-31

- Library is now 16 full guides, 0 summaries. The 8 former summaries, Microsoft, Notion, Salesforce, HubSpot, Shopify, Zoom, Discord, LinkedIn, were rewritten as full guides with 5 steps, 4 to 5 timeline stages, 6 checklist items, 3 blockers, agent vs human steps, official sources, and Medium confidence. No sign-in, app creation, or approval was completed for these, and that is stated in each guide.
- Live generation now returns a full guide, not a draft. api/research.js guideType is full, with 6 steps including submit for review, 4 timeline stages, 8 checklist items, and 5 blockers. The browser fallback on research failure is also a full schema guide with Unknown fields, not a 1 step summary.
- Site wording updated: hero shows 16 full guides, search hint says generates a full guide, llms.txt no longer calls any guide a summary or draft.
- Source check, 2026-10-31: all new guide sources returned 200, except Entra admin center which returned 403 to curl, likely a sign-in wall, while its Learn doc returned 200.
- Deployment note: guides.json was minified to 89,636 bytes because a single upload argument cannot exceed about 128 KB, and its base64 form was over that limit at 103 KB pretty printed. The site reads minified JSON the same way.
- Live verification, alias: guides.json lists 16 full, 0 summary; live Calendly research returns full, Medium, 6 steps, 4 timeline stages, 8 checklist items, 5 blockers.

## Verification split, fallback fix, and live browser test, 2026-10-31

- Point 1, fixed: verification is now separate from completeness. Every library guide has verificationStatus, shown on the card and in the guide detail, separate from guideType full.
  - Docs checked, 2 or more official sources, no sign-in test: GitHub, Slack, Google, Microsoft, Salesforce, HubSpot, Shopify, Zoom, LinkedIn, Claude, ChatGPT, Composio.
  - Docs checked, single official source, no sign-in test: Notion, Discord.
  - Partially verified, official page plus secondary sources, timeline Unknown, no sign-in test: Airtable.
  - Third-party only, official timeline not confirmed, no sign-in test: Meta.
  - Full still means all sections are present. It does not mean the guide was tested with a sign-in, and the detail view says that in words.
- Point 2, fixed: live research fallback is now a draft, not a full guide. If the research endpoint itself fails, the browser fallback guideType is draft, verificationStatus is Unverified, research failed, no official source fetched, and its next step says this is a draft, not a full guide. Successful live guides stay full in structure, but carry their own verificationStatus: Docs checked with 2 or more sources, Partially verified with a single source, or Unverified with no official source fetched. A nonsense app test returned full structure, Unverified, Low, 0 sources, which is the distinction working, not a verified claim.
- Point 3, test: API tests alone are not the claim. Live Calendly research returned full, Docs checked with 2 or more sources, Medium, 6 steps, via the deployed API. A live browser test was then run on the alias, typing Calendly in the merged search and pressing Get guide, with no sign-in, and separately opening Notion to check its verification line. Node.js deprecation warnings in Vercel logs are warnings, not a failure signal. A 200 API response with a guide, sources, and timings, plus a browser guide detail opening, is the successful test, not the absence of warnings. Browser test result is recorded separately when it returns, and is not claimed before it returns.

## Live browser test, 2026-10-31 5:51pm EDT, Calendly and Notion

- Browser test passed both checks, no sign-in, no provider submission, on the alias.
- Calendly, unfamiliar app: guide detail opened, labeled FULL and GENERATED, FROM LIVE RESEARCH, difficulty MEDIUM TO HARD, not draft. Verification line: Docs checked, 2 or more sources, no sign-in test. Full means the guide has all sections, it does not mean it was tested with a sign-in. 6 steps, confidence Medium, 3 sources, all Calendly developer docs.
- Important caveat, not hidden: the browser banner said cached guide, returned instantly, 0.0s. The guide execution record itself ran 1,281ms. So this test proves the browser end to end UI and the cached live guide, not a fresh Tavily search in the browser. Fresh API research for Calendly was verified separately via the deployed API, but a fresh browser search, with cache bypass, is still untested in the browser.
- Notion, library guide: guide detail opened, EASY TO MEDIUM, FULL, PRODUCTIVITY. Verification line, exact: Docs checked, single official source, no sign-in test. Full means the guide has all sections, it does not mean it was tested with a sign-in.
- Minor: one transient browser error on the first Back to all platforms click, retry succeeded. No impact on the checks.

## Fresh browser test, any site not in library, Stripe, 2026-10-31 5:57pm EDT

- Stripe is not in the 16 library guides. Browser test, no sign-in, no provider submission: search Stripe, Get guide, then Refresh live research to bypass cache.
- Refreshed guide only: FULL, MEDIUM TO HARD, GENERATED, FROM LIVE RESEARCH. Verification: Docs checked, 2 or more sources, no sign-in test. Confidence Medium. 6 steps. Sources, both official: docs.stripe.com/stripe-apps/api-authentication/oauth, docs.stripe.com/connect/oauth-reference.
- Banner after refresh: Live research complete for Stripe in 6.2s, docs 6.2s, confidence Medium, and it did NOT say cached. Initial Get guide result had said cached, returned instantly, which is why the refresh mattered.
- Honest limits in the refreshed guide: setup time Unknown, registration steps were not fully found in fetched pages, approval wait Varies, no fixed timeline confirmed. That is not a perfect guide, it is a Medium guide with official sources and explicit Unknowns.
- Other any-site fresh API results, same day, for context: Dropbox fresh returned full structure, Unverified, Low, 0 sources, so it is a failure to fetch official docs, not a pass. Monday.com fresh returned full, Docs checked with 2 or more sources, but confidence Low, so verification and confidence are separate.

## Validation layer, 2026-10-31 evening, production dpl_CCeaairhC6G3FSdbgXqrM9ApEnrX, GitHub bfff9e15

- No new research stages were added in this round, per direction. Only the final reasoning and validation layer changed.
- Passage meaning, not keyword presence: a requirement is mandatory only if its passage says so. "No review required", "not required", "you do not need", and "not necessary" set a requirement to not applicable. "Required only for" and "only if" set it to conditional. "Optional" sets it to optional. "Must" and "required" set it to required. Otherwise unknown.
- Approval wait, difficulty, timeline, steps, checklist, and blockers all follow that classification. If docs say no review is required, approval wait is "No provider review required, per fetched docs", not Varies or Unknown, and no review submission step or blocker is presented as required.
- Template override guard: after steps are built, any step still marked required when its requirement is not applicable or optional is downgraded, and its detail says so. The quality gate records this check.
- Navigation filtering: nav, header, and footer blocks are stripped before extraction. Snippets that are only navigation, with 3 or more nav tokens and no action verb, are rejected. Approval snippets that are actually email, phone, two-factor, or domain verification, without app review or publish language, are rejected.
- False scope filtering: scope tokens starting with www, api, oauth, auth, login, signup, http, or https are rejected, in addition to the existing credential token and CSS filters.
- Relative authorize paths are stored as paths only, never resolved into guessed full URLs on a docs host. A docs host is not the app host.
- Document cache poison fix: short JS shell pages were cached as if they were real docs, so later runs on a warm instance never refetched them. Now only qualifying pages, with OAuth, client ID, or scope mentions, are cached, under a v2 key, and a non-qualifying cache hit falls through to a fresh fetch.
- JS shell fallback, generic: a docs page under 2000 characters tries its .md variant once, with the trailing slash fixed, so getting-started.md is tried, not getting-started/.md.
- Trello, honest failure, not a pass: Trello docs are JS shells, 1890 characters, with no OAuth, client ID, or scope text in the static fetch, and the .md variant returns the same shell from this server. Its docs moved to developer.atlassian.com/cloud/trello/, which the provider-host filter does not accept as trello.com. The engine therefore returns a draft, unknown, not an invented OAuth guide. This is a documented limitation, not a validation-layer failure to hide.
- Ghost, honest failure, not a pass: for the ambiguous name Ghost, Tavily returns generic OAuth pages, 0 provider-specific, and site navigation finds no docs. The draft now says provider identification failed and asks for the official website or docs URL, rather than guessing ghost.com.

## Unfamiliar-provider retest, validation layer, 2026-10-31 evening

- Production deployment at test time: dpl_CCeaairhC6G3FSdbgXqrM9ApEnrX. GitHub code sync: bfff9e15. Harness: scripts/eval.js, 15 second gaps, refresh=1, 11 generic checks per provider, no provider-specific answers hardcoded in the harness.
- Result: 120 of 132 checks, 10 full guides, 2 drafts, 0 errors.
- Full, 11 of 11: Typeform (oauth, Medium, 7 steps, 2 sources, 4 tracks, 1309ms), Monday.com (api_key, Medium, 5 steps, 6 sources, 3 tracks, 1284ms), Stripe (oauth, Low, 7 steps, 6 sources, 4 tracks, 5365ms), Dropbox (oauth, Medium, 7 steps, 2 sources, 4 tracks, 1946ms), Intercom (oauth, Low, 7 steps, 8 sources, 5 tracks, 346ms), Webflow (oauth, Low, 8 steps, 4 sources, 6 tracks, 902ms), Todoist (oauth, Medium, 8 steps, 2 sources, 5 tracks, 409ms), BigCommerce (oauth, Medium, 7 steps, 4 sources, 5 tracks, 1088ms).
- Full, 10 of 11, only console Unknown, no false console claim: Zendesk (oauth, Low, 7 steps, 4 sources, 4 tracks, 980ms), Xero (api_key, Medium, 6 steps, 6 sources, 4 tracks, 2086ms).
- Drafts, 6 of 11, honest failures: Trello (unknown, 4 steps, 0 sources, 0 tracks, 1186ms, JS shell docs, see validation notes), Ghost (unknown, 4 steps, 0 sources, 0 tracks, 978ms, provider identification failed, ambiguous name).
- Known weaknesses, not hidden by the score: the harness checks that auth is known, not that it matches ground truth. Monday.com and Xero returned api_key in this run, even though both have OAuth docs, because fetched pages were API-key heavy and OAuth endpoints were not extracted. Dropbox console in this run was a paper API page, not the OAuth guide, even though it passed the not-an-API-reference check. Console Unknown for Zendesk and Xero is honest, not a false link, but it is a usability gap.
- Approval handling in this run: no guide claimed a fixed timeline. Approval wait was Unknown or Varies, with no fixed timeline confirmed, in all 12. No guide was marked required for public review without evidence, per the passage meaning layer.

## Final upgrade, semantic validation, 2026-10-31 evening

- Goal: 9/10 reliable guidance, not more documents. No UI redesign, no new platforms, no rebuild of infrastructure.
- Semantic reasoning, deterministic, not keyword presence: a requirement is marked required, optional, conditional, or not applicable only when the sentence that mentions that requirement, in its section, explicitly supports it. Negation ("not required", "does not support"), conditional ("required only for public apps", "required before restricted scopes"), exception ("can bypass", "without review", "exempt"), alternative ("either OAuth or API key", "may use"), dependency ("required before"), optional ("recommended but not mandatory", "optional"), and plan, scope, region, or distribution specific conditions are all classified from that sentence, not from a word elsewhere on the page.
- Structured parsing: headings are preserved as SECTION markers, lists and tables are preserved, navigation, headers, footers, scripts, styles, svg, and noscript are removed, and code examples about unrelated features are dropped. Only code blocks mentioning OAuth, authorize, token, scope, client ID, or API key are kept. Evidence snippets carry their section, so a rule is taken from the correct section, not an arbitrary nearby sentence.
- Evidence-to-decision engine: 11 approval and path decisions are recorded for every generated guide, each with claim, status, condition, exact passage, section, source URL, source support flag, contradictions, confidence, and justification. Decisions cover immediate testing, registration required, private use, public approval, marketplace optional or mandatory, scope-tied verification, admin consent, eligibility thresholds, documents required, review timeline availability, and alternative auth paths.
- Semantic interpretation layer, evaluated, not assumed: a paid LLM is not used, and no local model is loaded in this Vercel serverless function. A local model would need model hosting, hundreds of megabytes, GPU or very slow CPU inference, and cold starts far beyond the current sub-second to few-second research times, and Vercel function size limits rule out bundling a model. Free inference APIs would add an unreliable external dependency, rate limits, and privacy exposure for provider docs, with no guarantee of structured output. The chosen layer is therefore deterministic sentence semantics, with a defined interface: any future model must return structured claims, each claim must be validated against a retrieved passage and source URL, and any claim that fails validation makes the guide a draft, never a full guide. The guide records semanticMethod as deterministic, so no AI reasoning is claimed that does not exist.
- Final consistency checker: before a guide is returned, every step is checked against its evidence. It fails validation, and the guide becomes a draft, if provider identity is ambiguous, if a source says OAuth is not supported but auth is classified OAuth, if the console is an API reference page, if a requirement is marked non-unknown without a cited passage and source URL, if evidence contains page metadata, if a step cites a URL not in endpoints or sources, if a step recommends OAuth while auth is not OAuth, if a step tells the developer to submit for review while docs say review is not required, if a step tells the developer to register while docs say registration is not required, or if a scope token is malformed. Broad scopes such as admin or all add a blocker requiring a stated use case, they are not silently recommended.
- Guide generation follows evidence: steps use the decision status, not a fixed template. If registration is not applicable, the guide contains a "Registration is not required, per docs" step, not a mandatory register step. If review is optional, the step states when it can be skipped. If both OAuth and API keys are documented, a "Choose the simplest auth path" step explains own account versus other users. If auth is key plus token, steps list paths only, not invented full URLs.
- Factual confidence: confidence is Low when key registration and approval decisions are both Unknown, even if many sources were retrieved. Source count alone does not raise confidence. Verification status becomes Unverified, validation failed, when the checker fails.
- Provider identity separation: fetched pages are clustered by base domain, only the dominant evidence cluster is kept, other same-name domains are discarded and recorded, not merged. Search consensus, not a guessed .com, sets the canonical domain, so Square can be squareup.com and Ghost can be ghost.org, without hardcoded exceptions. A tie for first place with equal evidence is ambiguous, and the guide becomes a draft.

## Final priority, factual accuracy, 2026-10-31 evening

- No UI redesign, no new platforms, no provider-specific patches. Only interpretation and validation changed.
- Linked negation and modal proximity: a negation or must/required word counts only when linked to the exact action in that sentence. Example handling: "You don't need to start from scratch to create your app" does not mark registration as not applicable, because the negation modifies starting from scratch, not creating the app. Example and suggestion sentences ("for example", "you can", "you may", "recommended" without a linked must) are marked optional or unknown, not required.
- Evidence must contain a verb: a bare heading or list title without an action verb is skipped as evidence.
- Auth systems distinguished: third-party OAuth, sign-in OAuth, registration-free OAuth, API key, personal token, service account, MCP authentication, and SSO/enterprise are recorded separately. Sign-in only is not classified as third-party OAuth. Registration-free OAuth sets registration to not applicable.
- Atomic claims: every requirement, auth system, and endpoint is a separate claim with proposition, provider domain, auth context, source URL, exact passage, section, classification, condition, confidence, verified flag, and contradictory evidence. A claim is verified only when its passage entails it and its source URL is in the sources list.
- Semantic verification, honest: method is deterministic sentence semantics with linked negation, model used is false. No free or local model is available in this Vercel serverless function without a paid dependency, slow inference, or an unreliable external API. The rule engine is not presented as semantic understanding. Complex cases that do not follow linked patterns are marked Unknown.
- Identity fix found in evaluation: search consensus could be hijacked by a third-party directory. Trello was returned as full with apis.io sources, and Loom as full with atlassian.com sources, even though neither host contains the provider name. Fix, system-wide, not provider-specific: canonical domain must contain the provider slug, title-only search matches were removed, and a dominant cluster that does not contain the slug is ambiguous and makes the guide a draft. After the fix, Trello and Loom return draft unknown with 0 sources, BigCommerce returns full after a placeholder URL checker fix, and Figma returns full Medium with canonical figma.com. A draft is preferred to a confident guide with the wrong provider.
- Research failed now includes auth unknown: a guide with unknown authentication cannot be full, even if client, scopes, or endpoints were found. Loom previously was full with unknown auth, that path is closed.
- Placeholder URL checker fix: URLs in evidence quotes, and URLs containing { } placeholders, are not treated as recommended endpoints. BigCommerce previously became a draft because a docs example URL https://{app_origin}/api/app/auth was flagged as a cited URL. That was a checker bug, not a content error, and it is fixed.
- Factual verification separate from structure: quality gate reports factual verification as unverified, partial, or docs checked, plus claims verified count. Confidence is Low when key registration and approval decisions are both Unknown.

## Unseen-provider evaluation, accuracy code, 2026-10-31 evening

- Harness: scripts/eval.js, 18 generic checks per provider, refresh=1, 15 second gaps. Checks include provider host match, auth known, console valid and not an API reference, scopes clean and well formed, approval separated, evidence coverage, no invented fixed timeline, guide actionable, guide full, verification not High, requirement passage backed, steps not contradictory, evidence metadata clean, provider identity single, validation gate honest, and no invented mandatory approval.
- Previous 25-provider run, before accuracy code, production dpl_CMcZ: 420 of 450 checks, 22 full, 3 drafts, 0 errors. Per-provider failures were mostly console Unknown, not false links. Critical identity failures in that run, found on inspection, not by the harness score alone: Trello full with apis.io sources, Loom full with atlassian.com sources and unknown auth, and Firebase mixing firebase.google.com with developers.google.com. Those guides passed the harness score but were factually wrong on provider identity, which is why the harness score alone is not a factual accuracy score.
- Identity fixes after that run, system-wide: canonical domain is now a full host, not a base domain, so firebase.google.com is not collapsed to google.com. Tavily title-only matches were removed, canonical counting requires a slug-containing host label, identity clustering is by full host, and forum and community paths are excluded. After those fixes, spot checks on production dpl_9XuY: Figma full oauth Medium with only developers.figma.com sources, Firebase draft unknown with only firebase.google.com sources, Square draft unknown with only developer.squareup.com docs sources and no forums. Square flipped from full oauth in one run to draft unknown in the next, showing run-to-run variance in fetched pages and auth classification, a remaining reliability limitation, not a stable pass.
- Unseen 10-provider run, accuracy code, before the host-cluster fix, production dpl_DfhW: 173 of 180 checks, 9 full, 1 draft, 0 errors. GitLab 17 of 18, console Unknown. Supabase 17 of 18, console Unknown. Firebase 16 of 18, draft, provider host match failed because sources mixed firebase.google.com with developers.google.com, which is the identity bug fixed after this run, see above. Auth0 18 of 18. Okta 18 of 18. Vercel 17 of 18, console Unknown. Netlify 18 of 18. Plaid 17 of 18, console Unknown. Adyen 18 of 18. Deel 17 of 18, console Unknown. No invented mandatory approval was found in this sample by the harness, no contradictory required/not-applicable steps, no malformed scopes in the final spot checks after the pem fix, and no guide claimed High confidence.
- Before-and-after, with the caveat that check sets changed: old 11-check retest, 120 of 132, 10 full, 2 drafts. New 18-check retest on the same 12 providers, 209 of 216, with the same caveat that new checks include stricter passage-backed and identity checks, so the totals are not directly comparable. The real improvement is not the total, it is that Trello, Loom, Firebase, and Square no longer return full guides with the wrong provider, and that mandatory, optional, conditional, and not applicable statuses now require a linked passage, not keyword presence.
- Remaining limitations, stated plainly: no guide was tested with a provider sign-in, so no approval was actually completed. Monday and Xero previously returned api_key despite OAuth docs, and that classification variance remains possible. Dropbox console was a paper API page in one run. Console Unknown remains common, which is honest but less useful. Run-to-run variance in Tavily and fetch results changes auth classification for some providers, as shown by Square. Scopes can still mix products on the same domain, as shown by Twilio Segment scopes in a Twilio guide. The rule engine is deterministic, not semantic, and complex documentation that does not follow linked patterns is marked Unknown.
- No 9/10 score is claimed. Harness checks are not human factual grading. The target is defensible guidance with explicit abstention, and this sample shows that abstention now happens for Trello, Loom, Firebase, Square, Freshdesk, and Ghost in earlier runs, instead of confident full guides with wrong providers.

## Final engineering push, 2026-10-31 evening

P0 fixes: auth direction and intent (structured relationships, external IdP guard, registration developer-context guard), claim-level entailment (subject, action, object, product, verification outcome), provider and product boundaries (scope only from permission-description pages, scopes grouped by product page, multiple-product scope step replaced, not merged), and an independent validation gate that re-checks step prose against raw text and removes unsupported required steps, making the guide a draft.
P1 fixes: source parsing (.json excluded, docs articles not consoles, token endpoints must contain oauth or authorize, near-scope window 200 chars, not 500).
Evaluation A: fixed-document regression 14/14 new, 11/14 old, scripts/fixed-doc-eval.js.
Evaluation B: see below. It is not a structural checklist score. Findings are classified correct and supported, correct but insufficiently supported, incorrect, or unknown and appropriately abstained, from official docs checked independently of the generated guide, and from the rendered guide instructions.
Limitations that remain, not hidden: Monday.com and Xero auth classification variance across runs; Dropbox console was a paper-api-alpha page in earlier runs, now console is Unknown under the stricter rule; console Unknown is now common and honest; run-to-run Tavily and fetch variance can still flip auth classification (Square full oauth to draft unknown in earlier rounds); scopes can still mix products on the same domain when both pages are permission-description pages for different products, in which case the per-product warning applies; JS-rendered docs cannot be read by static fetch; no guide has ever been tested with a provider sign-in; cache and rate limits are per Vercel instance, not global; the rule engine is deterministic, not semantic understanding.

## Evaluation B, final push, 12 unseen providers, production dpl_9VJcQFuGHnfahR6Ntbihk8TYvpTs

Structural harness total, scripts/eval.js, 18 checks per provider: 153/180, 7 full, 3 drafts, 2 errors. This total is NOT a factual accuracy rate. It counts console Unknown as a failure, and it does not check whether the auth direction or scopes are actually right. The independent classification below is the factual check, from official docs searched separately from the generated guides, and from the rendered guide instructions.

Independent expected findings, from official docs:
- Klarna: main API is API key, client ID for SDK, Sign in with Klarna is OIDC sign-in, not third-party API OAuth.
- Braintree: API keys for first-party, OAuth 2.0 for third-party merchants, docs under developer.paypal.com, a parent domain that does not contain the product name.
- Wise: OAuth 2.0 for partners, personal token for SMB own account, token endpoint POST /oauth/token, authorize wise.com/oauth/authorize.
- Airwallex: own-account access is client ID plus API key to a login endpoint, partner OAuth is separate, authorize airwallex.com/oauth/authorize, token api.airwallex.com/oauth/token.
- Mollie: API keys default, OAuth app access tokens for third-party, organization tokens, basic auth with client ID and secret for token generation. Docs say do not use API keys for third-party, use OAuth instead.
- GoCardless: partner OAuth, connect.gocardless.com/oauth/authorize and /oauth/access_token, plus own-account access tokens.
- Sentry: OAuth2 for third-party, internal integration tokens, personal tokens, public integrations submitted for approval to publish.
- Datadog: API key plus application key, personal and service access tokens, not OAuth for the main API. Docs domain is datadoghq.com, not datadog.com.
- PagerDuty: Scoped OAuth and Classic User OAuth, API tokens, private apps are not reviewed or published by PagerDuty.
- Atlassian: OAuth 2.0 3LO, Jira scopes such as read:jira-work, developer console, callback URLs, plus API tokens for service accounts.
- Bitbucket: OAuth consumers, callback URL, read, write, and admin permissions, plus Forge, distinct from Jira scopes. Docs under developer.atlassian.com and support.atlassian.com, parent domains that do not contain the product name.
- CircleCI: personal and project API tokens are the main API method, plus OAuth 2.0 Dynamic Client Registration, which is registration-free OAuth, and MCP OAuth for the hosted MCP server.

Generated guide results, production run:
- Klarna: full, api_key, Low, 2 sources, both docs.klarna.com. Correct and supported for the main API direction. Correct but insufficiently supported on Sign in with Klarna as a separate sign-in path, because the guide's main auth is api_key and the sign-in path is only in sources, not as a separate rendered step. No critical error.
- Braintree: draft, unknown, 0 sources. Appropriately abstained, not incorrect. Cause is parent-domain filtering: official docs live under developer.paypal.com, which does not contain braintree, so the identity rule rejects them. Useful coverage is zero for this provider, which is a limitation, not a false guide.
- Wise: full, oauth, Low, 7 sources, all docs.wise.com. Correct and supported for partner OAuth direction, endpoints, and alternative personal token. Console Unknown, honest, not a factual error.
- Airwallex: ERROR in the harness run, then 500 FUNCTION_INVOCATION_FAILED on direct retest. Critical failure, see crash fix below. Not counted as a pass.
- Mollie: full, oauth, Low, 3 sources, all docs.mollie.com. Correct and supported for third-party OAuth direction. Correct but insufficiently supported on the API key alternative as the simplest own-account path, because the guide's main path is OAuth and the API key alternative is only noted in the choose-path step when both are found.
- GoCardless: draft, unknown, 0 sources. Appropriately abstained in that run, not incorrect, but the cause is different from Braintree: no fetchable official pages were returned in that run, likely a JS-heavy docs site that static fetch cannot read, not a parent-domain rejection. Useful coverage is zero, and this needs a retest, not a pass.
- Sentry: full, oauth, Low, 3 sources, all docs.sentry.io. Correct and supported for third-party OAuth direction, with internal and personal tokens as alternatives in docs.
- Datadog: full, api_key, Low, 6 sources, all docs.datadoghq.com. Correct and supported for the main API direction. The harness providerHostMatch check failed only because it expects datadog.com, while the real docs domain is datadoghq.com. That harness failure is not a factual error.
- PagerDuty: full, oauth, Low, 2 sources, both docs.pagerduty.com. Correct and supported for OAuth direction, including private versus public distribution in docs.
- Atlassian: ERROR in the harness run, then 500 FUNCTION_INVOCATION_FAILED on direct retest. Critical failure, see crash fix below. Not counted as a pass.
- Bitbucket: draft, unknown, 0 sources. Appropriately abstained, not incorrect. Cause is parent-domain filtering, same as Braintree. Useful coverage is zero, which is a limitation.
- CircleCI: full, oauth, Low, 4 sources, including oauth-dynamic-client-registration and api-developers-guide, plus one changelog page that is not a docs page and should not be a source. Correct but insufficiently supported: OAuth Dynamic Client Registration is a real CircleCI OAuth path and is registration-free, so presenting OAuth as the main path without clearly ranking personal tokens as the simplest main API method risks sending a developer down the OAuth path first. The guide does record registration-free OAuth, but the rendered step order puts OAuth first. This is a direction-ranking weakness, not a false endpoint, and it is counted as correct but insufficiently supported, not as fully correct.

Independent summary for the 12, counting only asserted guides, not drafts or errors as passes:
- Correct and supported: Wise, Mollie, Sentry, Datadog, PagerDuty. That is 5 of 12 providers, 5 of 7 full guides.
- Correct but insufficiently supported: Klarna, CircleCI. That is 2 of 12.
- Unknown and appropriately abstained: Braintree, GoCardless, Bitbucket. That is 3 of 12, with zero useful coverage for those three.
- Incorrect or failed: Airwallex, Atlassian, both 500 errors in this run. That is 2 of 12, a critical-error rate of 2 in 12 for the run, before the crash fix.
- No unsupported mandatory registration or approval was found in the 7 full guides. No mismatched provider identities were found in the 7 full guides: all sources were on the correct provider domain, with Datadog's datadoghq.com counted as correct. No malformed scopes were found in the full guides. No guide claimed High confidence.
- Abstention rate: 3 drafts in 12, plus 2 errors, is 5 in 12 with no usable guide. That is high, and it must not be counted as excellent factual performance. It is honest, but it is not useful coverage.

## Crash fix, after Evaluation B

Airwallex and Atlassian both returned 500 FUNCTION_INVOCATION_FAILED on direct retest, reproducibly, on production dpl_9VJcQFuGHnfahR6Ntbihk8TYvpTs. Vercel gave no further error detail that I could read, so I do not claim a specific root cause. The systemic fix, not a provider exception, is:
- A catch-all wrapper around the research handler: any uncaught error now returns a draft guide with research failed, a clear next step, and the error recorded in the guide, instead of a 500 with no guide.
- A page-size guard: pages over 500KB are truncated to the first 500KB before parsing, to reduce memory failure risk from very large docs pages.
This fix is deployed and retested below. If Airwallex and Atlassian still fail after it, they remain failures, not passes.

## Root cause fix, after the crash fix deployment

The catch-all wrapper itself exposed the root cause: "Cannot access 'contradictions' before initialization". The guard block that groups scopes by product page pushed to `contradictions` at line 402, but `contradictions` was only declared later, at the authentication classification section. That is why only providers with scopes from multiple product pages crashed: Airwallex and Atlassian. Other providers never took that branch, so they never hit the error. Fix: declare `contradictions` before the scope-grouping block, and remove the later duplicate declaration. The catch-all wrapper stays in place, so any future uncaught error still returns a draft instead of a 500.

## Retest after root cause fix, production dpl_Htj89qQCSo3r3wwEcmABWNzNu3ZC

- Airwallex: draft, oauth, Low, 8 steps, 4 sources, all airwallex.com, scopes from multiple products flagged, validation failures on the Choose scopes step because step text cites scope URLs with a trailing colon that do not match the sources list exactly. Direction is now correct, partner OAuth plus API key alternative both present, but the guide is a draft, not a pass, because validation failed. No crash.
- Atlassian: draft, unknown, Low, 4 steps, 7 sources, all developer.atlassian.com. Auth is unknown, not OAuth, because Atlassian OAuth endpoints live on auth.atlassian.com, not on the docs host, so the strict provider-host rule drops them. That is honest abstention, not a wrong direction, and useful coverage for Atlassian is low. No crash.
- GoCardless retest: draft, unknown, 0 sources, same as the first run. Stable fetch limitation, not a pass.
- Figma regression retest: full, oauth, Medium, 7 steps, 3 sources, all developers.figma.com, console Unknown, no validation failures. Unchanged from the pre-fix check.

## Release gate outcome, final push

Gate criteria, checked honestly:
- No known critical contradiction in the regression suite: pass, Evaluation A 14/14, no change after the root cause fix.
- No mismatched identities in the manually reviewed sample: pass, all 7 full guides use the correct provider domain, Datadog's datadoghq.com counted as correct.
- No unsupported mandatory registration or approval as fact: pass, none found in the full guides.
- No incorrect OAuth direction in regression: pass, Evaluation A and the full guides agree with official docs on direction.
- No malformed or unrelated scopes recommended as necessary: pass in full guides, Airwallex scopes are grouped by product and flagged, not presented as one list.
- Mandatory actions have genuinely relevant passages: pass, strict requirement rule, full guides only.
- Missing information honestly represented: pass, drafts, Unknowns, and validation failures are shown, not hidden.
- Static guides and UX still work: pass for static library and API, but no browser test has been run on the new engine, so browser rendering of the new auth relationships and scope sections is unverified, not claimed.
- Live research, caching, and rate limiting still function: live research works, refresh works, rate limiting was not retested in this round, so it is not claimed as re-verified.
- GitHub and production deploy the same code: pass after the final push below, see deployment and commit.

Gate verdict: pass on safety, with limited coverage. No developer is confidently sent down a wrong path in the full guides, which is the stated definition of success. Coverage is the limitation: 7 full guides in 12, 5 in 12 with no usable guide, 2 of those being honest abstentions with zero coverage, 1 being a fetch limitation, 1 being a draft with correct direction but validation failures, and 1 being a draft with unknown auth. That must not be presented as excellent factual performance. It is a defensible submission-ready MVP on safety, not a complete 12 in 12.
