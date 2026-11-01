# Adversarial test sets, final hardening, 2026-10-31

Main set, 30 providers, previously untested in any prior eval or implementation decision:
Asana, ClickUp, Pipedrive, Todoist, Miro, Webflow, Framer, Canva, Grammarly, Toggl Track,
Clockify, Harvest, Bonsai, HoneyBook, Workday, ServiceNow, Snowflake, Railway, Render,
Fly.io, PlanetScale, Neon, Clerk, Stytch, WorkOS, Cohere, Mistral, DeepSeek, PayPal,
Razorpay, Midjourney

Categories covered: mainstream SaaS (Asana, ClickUp, Pipedrive, Todoist, Miro, Webflow, Framer, Canva, Grammarly), obscure SaaS (Toggl Track, Clockify, Harvest, Bonsai, HoneyBook), enterprise (Workday, ServiceNow, Snowflake), developer infrastructure (Railway, Render, Fly.io, PlanetScale, Neon, Clerk, Stytch, WorkOS), API-key-only candidates (Cohere, Mistral, DeepSeek), multiple auth methods (PayPal, Razorpay), no public API candidate (Midjourney).

Holdout set, 10 providers, NOT used while implementing fixes, and no code changes will be made based on holdout results, only reported:
Replicate, Hugging Face, Paddle, Paystack, Dubsado, Acuity Scheduling, Turso, PropelAuth, Character AI, Mercury

Holdout categories: API-key-only candidates (Replicate, Hugging Face), multiple auth methods (Paddle, Paystack), obscure SaaS (Dubsado, Acuity Scheduling), developer infrastructure (Turso, PropelAuth), no public API candidate (Character AI), ambiguous brand name (Mercury, bank versus planet versus other products).
