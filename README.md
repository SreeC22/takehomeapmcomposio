# OAuth Setup Guides

**Know what it takes to connect an app—before you build the integration.**

A working take-home for **Composio's APM Integrations assignment**. Developers and agent builders can find a provider, understand the path to a usable OAuth connection, and leave with a shareable checklist grounded in real documentation.

**[Launch the live experience](https://takehomeapmcomposio-sreekaree-chityalas-projects.vercel.app/)** · [Browse the guide data](guides.json) · [See the verification log](VERIFICATION-LOG.md)

> **Built scope:** 16 curated examples + on-demand research for unfamiliar apps. The 100-app library is the longer-term goal, not a claim about this take-home.

## Why this exists

A developer building an AI agent wants their **users** to connect an external service. That can require a *provider OAuth app*—a developer-owned client with redirect URLs, scopes, credentials, and sometimes review or approval. But creating one is not always necessary: **Composio-managed OAuth may already cover the provider.**

The product answers five questions in order:

1. **Do I need my own OAuth app?** Managed vs. bring-your-own vs. not yet confirmed.
2. **Where do I start?** The real developer portal or official registration instructions.
3. **What will it take?** Prerequisites, permissions, redirects, difficulty, hands-on time, and approval wait.
4. **What blocks launch?** Review requirements, pricing or account restrictions, and unknowns.
5. **What can the agent do—and where must I take over?** Source-backed investigation and a concrete human handoff.

## Try the experience — reviewer walkthrough

| Demo | Why it matters | What to look at |
| --- | --- | --- |
| **[GitHub](https://takehomeapmcomposio-sreekaree-chityalas-projects.vercel.app/#guide=github)** | A relatively straightforward OAuth app | Managed-vs-custom decision, client registration, scopes, standard consent |
| **[Google](https://takehomeapmcomposio-sreekaree-chityalas-projects.vercel.app/#guide=google)** | A more demanding verification path | Sensitive/restricted scopes, consent setup, possible review delays |
| **[Shopify](https://takehomeapmcomposio-sreekaree-chityalas-projects.vercel.app/#guide=shopify)** | Distribution changes the approval path | Development/custom use vs. public App Store distribution |
| **An unfamiliar app** | Proves this is more than a static library | Enter **Attio**, **Cal.com**, or **Miro** in the homepage search and select **Get guide** |

**Suggested live demo:** Open GitHub → compare managed and custom OAuth → inspect Google's review requirements → search **Attio** → inspect the official sources and missing claims → copy its **share link** and **agent setup brief**.

For a counterexample, try **Baserow**. If the research cannot establish third-party OAuth, it returns **Draft / Unknown** instead of manufacturing an OAuth procedure. This is intentional.

## What you get

Each guide brings together:

| Before implementing | While making progress |
| --- | --- |
| Managed OAuth availability (when documented) | A verified portal URL or official registration document |
| Difficulty, hands-on effort, approval wait or **Unknown** | Step-by-step actions, dependencies, checklists and common blockers |
| Required vs. conditional vs. unverified claims | Links to original sources and explanations of uncertainty |
| A decision about the authentication path | Agent research log, work attempted, and human takeover |
| — | **Copy share link**, **Copy agent setup brief**, and structured JSON |

The **same guide data** powers the web UI and the agent-readable files in [`guides/`](guides/) and [`guides.json`](guides.json).

### Why the managed-OAuth check comes first

If Composio already provides managed OAuth, a developer may be able to connect users **without registering and waiting for approval on a new provider app**. The app checks each provider's *public Composio toolkit documentation*:

- **Managed available** — documented for that toolkit (for example, GitHub and Attio).
- **Bring your own** — managed OAuth explicitly unavailable (for example, Pipedrive).
- **Unknown** — not confirmed from public documentation; the guide links to the evidence rather than guessing.

This does **not** query an authenticated Composio toolkit inventory.

## How live research works

```text
App name / website
       ↓
Identify provider + locate official developer documentation
       ↓
Fetch pages; extract OAuth, registration, scopes, redirects, review
       ↓
Filter unrelated SSO/admin docs and validate source-backed claims
       ↓
Full / Partial / Draft guide + next action + research trail
       ↓
Developer follows guide; agent can use exported setup brief
```

- **Implementation:** vanilla JavaScript frontend, Vercel serverless endpoints and a small, checked-in guide library. No app database.
- **Discovery:** [`api/research.js`](api/research.js) uses **Tavily** for search, then fetches and analyzes provider pages.
- **Evidence rules:** [`api/research-helpers.js`](api/research-helpers.js) filters metadata mistaken for scopes, mismatched OAuth endpoint domains, unrelated SSO flows and unsupported approval claims.
- **Managed coverage:** [`api/managed-auth.js`](api/managed-auth.js) checks public Composio toolkit documentation.
- **Share:** generated guides can be packaged into a compact, compressed URL fragment; the agent brief is copyable text.

**Agent boundary:** this is a **deterministic investigation workflow**, not an LLM reasoning agent or an authenticated browser agent. It genuinely searches and retrieves documentation, prepares the guide, and may make a **read-only HTTP reachability check** on a documented developer portal. It **does not** sign in, create an OAuth client, exchange live user tokens, or submit an approval request. The interface separates completed research from these human-owned actions.

### Evidence and guide status

- **Full:** complete enough from retrieved documentation; **not** a passed real OAuth test.
- **Partial:** some usable facts, but important registration, scope, or approval details remain unconfirmed.
- **Draft:** identity/authentication ambiguous, insufficient documentation, or failed validation.

Estimated setup/engineering time is explicitly a **planning estimate**, not a provider-published SLA. An unknown review wait is displayed as **Unknown**.

## What we checked, corrected, and couldn't verify

| Example | What the evidence taught us |
| --- | --- |
| **GitHub / Google / Shopify** | Reviewed varied setup and approval patterns using provider documentation; real provider sign-in and app approval were **not** performed. |
| **Slack, Google, Meta** | Corrected public-distribution wording, softened timeline ranges, and removed unjustified confidence about approval wait. |
| **Notion / Attio / Intercom** | Fixed misclassified authentication direction and fabricated permission tokens originating from documentation metadata. |
| **Baserow** | Separated GitHub SSO *into Baserow* from third-party OAuth *to the Baserow API*; unresolved access is labeled Draft. |
| **Cal.com / unfamiliar apps** | Captured official OAuth docs, portal and review evidence where available; missing endpoints, approval time or portal remain unverified. |
| **Dynamic registration** | Corrected an earlier interpretation: **dynamic client registration still registers a client**; it does not automatically mean that registration can be skipped. |

Fresh production API checks for **Attio, Cal.com, Pipedrive, PostHog, Miro, and Baserow** returned guides, but the outputs were **Partial or Draft**, not end-to-end verified procedures. The [verification log](VERIFICATION-LOG.md) and [research/evaluation notes](SUBMISSION-NOTES.md) contain the supporting checks, changes, and remaining unknowns.

## Run locally

**Prerequisites:** Node.js 20+; Vercel CLI for serverless research; a **Tavily API key** for live lookup of unfamiliar providers.

```bash
git clone https://github.com/SreeC22/takehomeapmcomposio.git
cd takehomeapmcomposio
export TAVILY_API_KEY="your_tavily_key"
npx vercel dev
```

The CLI may prompt you to sign in and link/create a Vercel project. Open the localhost address it provides. Keep the key in your **server environment**, not in client-side code or Git. Local `.env` files are ignored by [`.gitignore`](.gitignore).

To view only the **16 curated library guides** without the live research API:

```bash
npx serve .
```

To run the no-provider-account regression checks:

```bash
node scripts/trust-regression.js
node scripts/registration-qa-regression.js
node scripts/assignment-readiness-regression.js
```

## Scope and limitations

- This is a **focused working slice**, not 100 completed OAuth guides.
- The research can miss gated, JavaScript-rendered, newly changed, or unusually structured documentation. Some unfamiliar apps will be **Partial/Draft**.
- **No OAuth account setup, real-user consent, token exchange, or provider review was executed.** A public portal HEAD response is not evidence of successful login.
- A documented **Full** guide means documentary completeness, **not** production readiness. Human verification is still necessary.
- Managed-auth status is based on **public toolkit pages**, not authenticated Composio availability. Inconclusive results remain Unknown.
- Shared generated guides use self-contained URL fragments rather than server-hosted permanent records; links can be long. Full visual cross-device QA has not been completed.
- Research relies on a server-side Tavily key, network availability, and per-instance rate limits/cache.

**Product principle:** **make the next step obvious, and make uncertainty visible.**
