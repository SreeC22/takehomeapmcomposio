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
