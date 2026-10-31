# Verification log

Checked on 2026-10-31, from search results, not from completed provider sign-ins or approvals.

## Checked and confirmed, with a source

- GitHub OAuth flow: OAuth apps use client ID and client secret, redirect URLs must match, scopes limit access and do not grant more than the user already has. Sources in the GitHub guide are GitHub Docs pages found in search.
- Slack OAuth: Slack apps use a v2 OAuth 2.0 flow, scopes determine access, install flow is request scopes, user approval, exchange code for token, redirect URLs must match. Sources in the Slack guide are Slack Developer Docs pages found in search.
- Google scope tiers: Google groups scopes into non-sensitive, sensitive, and restricted. Restricted scopes can require a security assessment, and brand verification typically takes 2 to 3 business days if branding changed. Source in the Google guide is the Google Developers restricted scope verification page found in search.

## Corrected or downgraded

- Google approval time: early drafts in many blog posts give a single number. This guide keeps ranges instead, because Google guidance found in search gives different ranges for brand, sensitive, and restricted verification, and because time depends on submission quality and review rounds.
- Meta approval time: no single fixed timeline was confirmed from an official Meta page in this check, so the Meta guide marks timeline as varies and Low to Medium confidence, instead of inventing a number. Meta sources in the guide are third party guides summarizing App Review, and that limitation is stated in the guide.
- Summary guides: Microsoft, Notion, Salesforce, HubSpot, Shopify, Zoom, Discord, and LinkedIn are marked summary, Low confidence, and not verified, instead of being presented as full guides. They must be expanded and checked before use.

## Could not verify

- Exact current console layouts for GitHub, Slack, Google, and Meta, which change over time.
- Exact Meta App Review timeline for a specific permission.
- Exact third party security assessment cost for Google restricted scopes, which varies by assessor.
- Any provider approval outcome, because no app creation or review submission was completed.
- All details in summary guides.

## What was not tested

- No sign-in to GitHub, Slack, Google, or Meta developer consoles.
- No OAuth app creation.
- No user consent flow with a real account.
- No App Review or verification submission.
- No paid accounts.


Fixes on 2026-10-31, from reviewer critique:
- Live generation template replaced by api/research.js, which searches, fetches, extracts, and logs, with Unknowns for unverified claims.
- Generated guides now shareable via encoded URL hash and local storage, and appear in search immediately after generation.
- User-provided text is escaped before HTML insertion in app.js.
- README link on deployed site confirmed 404 in live browser on 2026-10-31. Fix: readme.html rendered page on site, plus visible GitHub link in header and footer.
- Sampled verification report added to home page for GitHub, Slack, Google, Meta, and Airtable, comparing initial claim, source check, and result.
- Per-guide execution records added to guide detail, with sources checked, tested notes, and not verified lists.
- Airtable added as a full guide from Nango, Formbricks, and Pipedream sources, with official page limits noted.

## Final engineering push, 2026-10-31 evening

- Evaluation A, fixed documents: new logic 14/14, old logic 11/14, on identical captured passages. Improvements: negated "start from scratch", token endpoint categorization, docs URL rejected as console.
- Evaluation B, 12 unseen providers, production dpl_9VJcQFuGHnfahR6Ntbihk8TYvpTs, structural harness 153/180, not a factual rate. Independent classification: correct and supported Wise, Mollie, Sentry, Datadog, PagerDuty; correct but insufficiently supported Klarna, CircleCI; appropriately abstained Braintree, GoCardless, Bitbucket; errors Airwallex, Atlassian, both 500s.
- Root cause of the 500s: `contradictions` used before declaration, in the multi-product scope grouping block. Only providers with scopes from multiple product pages crashed. Fixed by declaring it before that block. Catch-all handler wrapper and 500KB page truncation remain in place.
- Retest, production dpl_Htj89qQCSo3r3wwEcmABWNzNu3ZC: Airwallex draft oauth, Atlassian draft unknown, GoCardless draft unknown 0 sources, Figma full oauth Medium, no validation failures. No crashes.
- Release gate: pass on safety, limited coverage, see SUBMISSION-NOTES.md for the full gate check and its caveats. Browser rendering of the new engine sections is unverified, rate limiting was not retested in this round.
