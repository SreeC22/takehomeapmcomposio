# OAuth Setup Guides

**Composio APM Integrations take-home** — a working guide library and live documentation-research experience for developers who want their AI agents' users to connect an app.

**[Open the live application](https://takehomeapmcomposio-sreekaree-chityalas-projects.vercel.app/)** · **[Source repository](https://github.com/SreeC22/takehomeapmcomposio)**

## The problem and the product decision

Before users can connect an app, a developer needs to know **whether a provider-owned OAuth app is required at all**, where to register it, what scopes and redirect URLs are needed, whether review blocks launch, and which actions need a human.

The experience starts with **Composio-managed OAuth vs. bring-your-own OAuth**, then provides an actionable guide. It does not assume that every app supports third-party OAuth or that every OAuth app requires approval. When evidence is missing, it says **Unknown** instead of guessing.

## Try it in a minute

1. **[GitHub](https://takehomeapmcomposio-sreekaree-chityalas-projects.vercel.app/#guide=github)** — straightforward OAuth registration, no separate approval for standard OAuth scopes; compare the managed and custom paths.
2. **[Google](https://takehomeapmcomposio-sreekaree-chityalas-projects.vercel.app/#guide=google)** — sensitive/restricted scopes, consent configuration, verification and potentially significant review work.
3. **[Shopify](https://takehomeapmcomposio-sreekaree-chityalas-projects.vercel.app/#guide=shopify)** — development installation vs. public distribution and App Store review.
4. **Unfamiliar app:** type **Attio**, **Cal.com**, **Miro**, or a provider website in the search box and click **Get guide**. Watch live documentation research, inspect the source-backed results, and check what remains unverified. For example, Baserow safely returns a Draft rather than inventing a third-party OAuth flow.
5. Open any generated guide, inspect **Step 0**, **Next concrete action**, **Evidence**, **Research attempts**, and **Human takeover**, then use **Copy share link** or **Copy agent setup brief**.

**Scope:** 16 curated library guides plus on-demand generation. The assignment does not require all 100 planned guides.

## What each guide provides

| Developer question | What the guide shows |
| --- | --- |
| Do I need my own OAuth app? | Managed / bring-your-own / Unknown, based on the provider's public Composio toolkit documentation when available, with an official source link |
| Where do I start? | Verified developer portal or linked registration documentation; distinguishes a docs page from an app-creation portal |
| How difficult and how long? | Difficulty, separately labeled hands-on/engineering estimates, approval wait or Unknown; estimates are not provider SLAs |
| What can block launch? | Redirect rules, permissions/scopes, distribution/review requirements, tier limitations, contradictions and missing evidence |
| What can the agent do? | Documentation searches/fetches, extraction and checks, prepared steps and a limited read-only portal reachability probe when possible |
| When does a human take over? | Provider login, creating credentials, testing actual user consent, handling secrets, submitting for review |
| How do I use/share it? | Checklists, next action, original source URLs, compressed share snapshot, agent-ready brief and guide JSON |

Library guide JSON is at `guides.json` and `guides/<id>.json`. The human interface and agent-facing JSON use the same guide schema.

## Architecture and judgment about evidence

- **Frontend:** plain HTML, CSS and JavaScript; 16 checked-in guide JSON files, no database.
- **Live investigation:** `api/research.js` uses Tavily to discover official provider documentation, fetches pages, extracts evidence for authentication, registration, redirect URIs, scopes, review and blockers, and produces a guide.
- **Validation:** `api/research-helpers.js` filters page metadata and unrelated SSO/admin permission systems, validates endpoint hosts, and separates conditional requirements from mandatory ones.
- **Managed OAuth decision:** `api/managed-auth.js` checks public Composio toolkit docs. If a provider-specific managed-auth statement cannot be verified, it returns Unknown rather than inventing coverage.
- **Guide status:** **Full** = sufficiently complete *from documentation*, **Partial** = usable findings with gaps, **Draft** = unsupported or ambiguous. **Full does not mean an authenticated OAuth flow was tested.**
- **Agent boundary:** this is a **deterministic research workflow, not an LLM or browser automation agent**. It can research and prepare work, but does not sign in, create OAuth apps, exchange live user tokens or obtain approvals. A public HTTP HEAD probe confirms only reachability/redirect behavior, never a completed provider setup.

## Run locally

Requires **Node.js 20+** and the Vercel CLI (run with `npx`). For unfamiliar-app live research, provide a Tavily API key **as a server-side environment variable**.

```bash
git clone https://github.com/SreeC22/takehomeapmcomposio.git
cd takehomeapmcomposio
export TAVILY_API_KEY="your_tavily_key"
npx vercel dev
```

The Vercel CLI may prompt you to log in and link/create a project. Open the localhost URL it prints. Do **not** commit `.env` files or credentials; local secrets and Vercel metadata are ignored by `.gitignore`.

**Static-only preview**, with the 16 library guides but without server-side live research:

```bash
npx serve .
```

**Regression tests** (no provider account needed):

```bash
node scripts/trust-regression.js
node scripts/registration-qa-regression.js
node scripts/assignment-readiness-regression.js
```

## What was tested, learned and corrected

- Production smoke checks: homepage, in-site README, 16 library JSON guides, managed-OAuth lookup, and fresh research for **Attio, Cal.com, Pipedrive, PostHog, Miro and Baserow**. These API requests returned HTTP 200; their outputs were **Partial or Draft**, not fully verified setup guides.
- Spot-checked curated examples against documentation. Corrected **Slack** public-distribution wording, **Google** timeline ranges and **Meta** approval-time certainty; the evidence is logged in [VERIFICATION-LOG.md](VERIFICATION-LOG.md).
- Fixed fabricated OAuth scopes from docs metadata, wrong provider/API authentication direction, malformed endpoint URLs and misleading review requirements.
- Final QA distinguished **provider SSO instructions** from OAuth app registration and **dynamic client registration** from "registration is unnecessary"; regression tests cover both.
- Exercised guide UI and sharing logic with a generated Attio guide in a JavaScript harness: the shared snapshot retained the steps and sources. This is **not** the same as a full visual browser/device test.

More detailed experiments and provider outcomes: [SUBMISSION-NOTES.md](SUBMISSION-NOTES.md) and [VERIFICATION-LOG.md](VERIFICATION-LOG.md).

## Known limitations

- **No authenticated provider setup was performed:** no OAuth app created, consent flow completed, token exchanged, or review/approval submitted. The research log identifies attempted vs. unattempted actions.
- **Not universal yet:** unfamiliar providers may be Partial/Draft with missing registration portals, scopes, or approval details. Review official provider sources before implementing or launching.
- **Estimates are planning aids**, not guaranteed provider setup times or review SLAs. The system may miss JavaScript-rendered, gated or changing documentation.
- **Managed-auth lookup uses public toolkit documentation**, not an authenticated Composio toolkit inventory; absent evidence remains Unknown.
- **Generated guides are stored locally** and shared in compressed URL fragments, not a hosted persistent database. Links can still be lengthy; full cross-device browser QA remains outstanding.
- Research is subject to the Tavily key, network conditions and per-instance cache/rate limits. It is deterministic extraction, with no LLM reasoning or automated provider account actions.

## Repository map

`index.html`, `app.js`, `style.css` — UI · `guides.json`, `guides/` — curated examples · `api/research.js`, `api/research-helpers.js` — live investigation · `api/managed-auth.js` — managed OAuth check · `scripts/` — tests and evaluation · `readme.html` — in-site project description.
