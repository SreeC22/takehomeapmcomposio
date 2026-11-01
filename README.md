# OAuth Setup Guides

**From “Can our agent connect this app?” to “Here's the path to launch.”**

A searchable, source-backed guide library that helps developers set up provider OAuth apps, understand approval requirements, and know what to do next. Built for the **Composio APM Integrations take-home assignment**.

**[Explore the live product](https://takehomeapmcomposio-sreekaree-chityalas-projects.vercel.app/)** · [View the 16-guide library](guides.json) · [Verification notes](VERIFICATION-LOG.md)

---

## The problem

When an AI agent needs access to a user's external account, the developer may need to register an OAuth client with the provider. That process is rarely just “get a client ID.” It can involve account eligibility, redirect URIs, scopes, private testing, app verification, marketplace submission, and waiting for approval.

**The key product insight:** the best next step is sometimes **not to create an OAuth app at all**. Composio may offer managed authentication, or the provider may use a different authentication model.

This experience answers four questions in one place:

| Developer question | Product answer |
| --- | --- |
| **Do I need to create an app?** | Check Composio-managed OAuth, developer-owned OAuth, or an unconfirmed alternative |
| **What do I do next?** | Link to the developer portal or actual setup documentation, with ordered steps |
| **How hard will this be?** | Difficulty, hands-on estimates, approval wait, requirements, and likely blockers |
| **What can the agent handle?** | Research and prepared artifacts, with an explicit handoff for sign-in, credentials, testing, and approval |

The result is a **shareable guide someone can act on without the author explaining it**.

## Try it: a 2-minute reviewer walkthrough

**Start with three different launch paths:**

| App | Setup challenge | What to inspect |
| --- | --- | --- |
| **[GitHub](https://takehomeapmcomposio-sreekaree-chityalas-projects.vercel.app/#guide=github)** | Straightforward OAuth registration | Managed vs. custom OAuth, required settings, consent |
| **[Google](https://takehomeapmcomposio-sreekaree-chityalas-projects.vercel.app/#guide=google)** | Sensitive and restricted scopes | Consent configuration, verification requirements, review uncertainty |
| **[Shopify](https://takehomeapmcomposio-sreekaree-chityalas-projects.vercel.app/#guide=shopify)** | Distribution-dependent approval | Testing/custom use vs. App Store review |

**Then test live generation:**

1. Open the [app](https://takehomeapmcomposio-sreekaree-chityalas-projects.vercel.app/), type **Attio** (or paste an unfamiliar provider website), and click **Get guide**.
2. Inspect the generated **next action**, cited sources, difficulty, missing requirements, and research trail.
3. Try **Copy share link** or **Copy agent setup brief** to hand the work to someone else.

**Try an edge case:** search **Baserow**. When research cannot confirm third-party OAuth, the result stays **Draft / Unknown** rather than inventing an OAuth setup.

**Delivered scope:** 16 curated guides, plus live generation for apps outside the library. The assignment calls for a focused demonstration—not 100 completed guides.

## Product decisions

### 1. Decide whether a custom OAuth app is necessary

The first step checks the provider's public Composio toolkit documentation and reports:

- **Managed available:** Composio documents managed OAuth for the toolkit (e.g., GitHub, Attio).
- **Bring your own:** Composio documents that managed OAuth is unavailable (e.g., Pipedrive).
- **Unknown:** public documentation does not establish availability; the guide points to the official source.

**Why:** developers shouldn't spend days on registration and approval when they can use a managed connection. This lookup is based on **public documentation**, not an authenticated toolkit inventory.

### 2. Separate facts, estimates, and unknowns

A source-backed requirement is different from a planning assumption. Guides separate:

- **Provider-documented facts:** registration rules, scopes, redirects, review triggers, with source links.
- **Planning estimates:** hands-on setup and implementation effort—not provider SLAs.
- **Unverified details:** missing portals, timelines, approval conditions, or conflicting evidence.

Guide status means **Full** (documentarily complete), **Partial** (usable evidence with gaps), or **Draft** (critical authentication/evidence questions unresolved). **Full does not mean an OAuth connection has been tested.**

### 3. Let automation prepare the work, not invent completion

The live research workflow searches provider documentation, fetches relevant pages, extracts requirements, validates claims, and prepares a checklist and handoff. Where a trustworthy portal link is found, it may perform a **read-only HTTP reachability check**.

It records what was attempted and what remains for a human: account access, OAuth client creation, secret management, actual user consent/token testing, and review submission.

The investigation is **deterministic and source-driven**, not an LLM-powered browser agent. This is intentional: unsupported claims are marked Unknown rather than generated as instructions.

## How it works

**Input → official documentation search → evidence extraction → validation → actionable guide**

| Layer | Implementation |
| --- | --- |
| Interface | Vanilla JavaScript, HTML, CSS; searchable guides and shareable results |
| Curated library | [`guides.json`](guides.json) and [`guides/`](guides/) |
| Live discovery | [`api/research.js`](api/research.js), Tavily search, provider-page retrieval |
| Evidence validation | [`api/research-helpers.js`](api/research-helpers.js); guards against false scopes, wrong OAuth endpoints, unrelated SSO, and unsupported review claims |
| Managed OAuth check | [`api/managed-auth.js`](api/managed-auth.js), based on public Composio toolkit pages |
| Deployment | Vercel serverless API + static frontend; no application database |

Guides provide steps, blockers, approval notes, linked sources, research history, human-vs-agent responsibilities, and a copyable share snapshot. The same guide schema is available as JSON for agents.

## What I verified and corrected

I checked sample instructions against provider documentation and exercised the live generation flow. The most consequential findings:

| Finding | Change made |
| --- | --- |
| A provider's **SSO** documentation can mention OAuth without enabling third-party API connections | Separate SSO/login flows from developer-owned provider OAuth; Baserow is marked Draft when the path cannot be confirmed |
| Docs metadata and unrelated permission pages can look like OAuth **scopes** | Validate scope context and reject metadata-derived or unsupported permissions |
| “App review” can refer only to **marketplace listing**, not connecting users | Keep private testing, production OAuth access, and public listing decisions distinct |
| **Dynamic client registration** was mistaken for no registration | Treat it as a real registration mechanism with a different setup path |
| Approval timelines are often inconsistent or absent | Use documented ranges where supported; otherwise show Unknown instead of a promise |

**Live smoke checks:** GitHub/Google/Shopify guide paths, managed-OAuth decisions, and fresh searches for **Attio, Cal.com, Pipedrive, PostHog, Miro, and Baserow**. These unfamiliar-app responses were **Partial or Draft**—not end-to-end verified integrations.

The [verification log](VERIFICATION-LOG.md) and [research notes](SUBMISSION-NOTES.md) record supporting evidence, corrections, and known gaps. Share/handoff functionality has also been tested in a JavaScript harness; complete cross-device browser QA has not been performed.

## Run locally

**Requirements:** Node.js 20+, Vercel CLI, and a Tavily API key for live unfamiliar-app search.

```bash
git clone https://github.com/SreeC22/takehomeapmcomposio.git
cd takehomeapmcomposio
export TAVILY_API_KEY="your_tavily_key"
npx vercel dev
```

The Vercel CLI may ask you to sign in or link a project. Open the local URL it displays. Keep the Tavily key **server-side**; do not commit credentials or local `.env` files.

For a static preview of the 16 curated guides without live research:

```bash
npx serve .
```

Run regressions without provider credentials:

```bash
node scripts/trust-regression.js
node scripts/registration-qa-regression.js
node scripts/assignment-readiness-regression.js
```

## Scope and limitations

- **No provider OAuth app was registered, user consent flow completed, token exchanged, or approval submitted.** Documentation checks and public portal HTTP probes do not prove integration readiness.
- Generated guidance depends on available documentation and may miss gated, JavaScript-rendered, or newly changed details. **Partial/Draft guides require human verification.**
- Managed-OAuth status is based on public toolkit pages. Unconfirmed provider support stays **Unknown**.
- Shared generated guides are embedded in compressed URL fragments, not stored in a persistent backend; links may be long.
- Live research depends on Tavily, network access, and per-instance rate limits/cache. The 100-provider goal is future scope.

---

**Design principle:** *Make the next step clear. Make the evidence visible. Never hide the uncertainty.*
