OAuth Setup Guides - submission notes, paste ready

Live site: https://takehomeapmcomposio-id63hym83-sreekaree-chityalas-projects.vercel.app/
Repo: https://github.com/SreeC22/takehomeapmcomposio
Verified live on 2026-10-31: home page loads without sign-in, 12 guide cards show, searching GitHub filters to the GitHub card, and opening that card shows the card-by-card steps, review timeline card, and approval checklist card.
Redesign, 2026-10-31: cleaner white layout, platform logos, pill filters, hover cards, numbered steps, and shorter copy with less repetition. Guide content and data are unchanged.

What was built:
A searchable website for developers building AI agents. A developer picks an app they want their agent to connect to and gets a full card-by-card setup guide, with difficulty, active setup time separate from approval wait time, a review timeline card, an approval checklist card, blockers with fixes, agent vs human steps, sources, and uncertainty labels. Guides are also available as structured JSON for agents, from the same data as the human cards.

Demo apps:
- GitHub, Easy, full guide
- Slack, Medium, full guide
- Google, Medium to Hard, full guide
- Meta, Hard, full guide
- Microsoft, Notion, Salesforce, HubSpot, Shopify, Zoom, Discord, LinkedIn, summary guides that live generation can expand

How to test live generation:
Open the site, use the live generation form, enter an app outside the library, for example Figma, and open the draft guide. Drafts are labeled Agent draft, Low confidence, with Unknowns where official docs were not checked yet. The demo does not submit an OAuth app to any provider.

Key decisions:
- Same guide schema for every platform, so difficulty and time are comparable.
- Setup time separate from approval wait time.
- Card-by-card setup, plus timeline card and approval checklist card.
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
