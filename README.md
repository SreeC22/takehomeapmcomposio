# OAuth Setup Guides

A working website that helps developers building AI agents understand how to set up an OAuth app and get it approved for a platform, with card-by-card setup, review timeline, and approval checklist.

## Live use

Open `index.html` directly, or deploy this folder to Vercel as a static site. No build step, no backend, no login, and no secrets are needed to run it.

To deploy on Vercel:
1. Import this repo in Vercel.
2. Use the default static site settings, with no build command.
3. Open the deployed link in an incognito window and test search, a guide, and the live generation form.

## What is inside

- `index.html`, `style.css`, `app.js`: the searchable library, guide cards, guide detail view, and live generation demo.
- `guides.json`: the full guide index, in the same schema used for the human cards and the agent JSON.
- `guides/<id>.json`: one machine readable guide per platform, for example `guides/github.json`.
- `llms.txt`: a plain text index for agents and crawlers.
- `VERIFICATION-LOG.md`: what was checked, what was corrected, and what could not be verified.
- `SUBMISSION-NOTES.md`: paste-ready notes for the file upload submission.

## Guides included

Full card-by-card guides, checked against docs on 2026-10-31 as noted in each guide:
- GitHub, Easy
- Slack, Medium
- Google, Medium to Hard
- Meta, Hard

Summary guides, not verified, that live generation can expand:
- Microsoft, Notion, Salesforce, HubSpot, Shopify, Zoom, Discord, LinkedIn

## Key decisions

1. Same guide schema for every platform, so difficulty and time are comparable.
2. Setup time is reported separately from approval wait time, because that is the question developers actually ask.
3. Card-by-card setup, with a separate review timeline card and a separate approval checklist card, so a developer can see the gate before they submit.
4. Human cards and agent JSON come from the same data, so an agent can call `guides.json` or `guides/<id>.json` and get the same guide a human reads.
5. Live generation returns a draft labeled Agent draft, with sources to check and honest Unknowns, not a verified guide. It does not submit an OAuth app to any provider.
6. Agent vs human steps are explicit on every guide, because an agent cannot complete business verification, domain verification, or provider review for a developer.
7. Focused slice, not 100 thin guides. Four full guides that can be checked beat twelve guessed guides.

## Live generation, honest version

In this static demo, the submit form creates a draft guide in the standard schema, with investigation steps, a timeline marked Unknown, and a checklist to check against official docs. In a production agent run, that same prompt would first read official registration docs, scope lists, and review docs, then fill the draft with sources. The draft in this demo is clearly labeled and must be checked before use. Do not treat a draft as verified.

## Limitations

- No account sign-in, app creation, or provider approval was completed for these guides.
- Google and Meta timelines are ranges from guidance found in search results on 2026-10-31, not guarantees for a specific app. Meta timeline in particular was not confirmed from an official Meta page in this check, and is marked as such in the guide.
- Summary guides are not verified against official docs in this build.
- Provider consoles, scope names, and review rules change. Check the official docs linked in each guide before a launch decision.
- No credentials, tokens, or client secrets are included anywhere in this repo.

## Verification

See `VERIFICATION-LOG.md` for the sample checked, corrections made, and items that could not be verified.
