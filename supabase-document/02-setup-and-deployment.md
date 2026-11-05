# Setup and deployment runbook

> Current scope (2026-11-04): legacy browser-data import is deferred. The active app loads or initializes a fresh account-owned cloud document. Import instructions below are retained for future use; the feature is disabled by default.

## 1. Install and configure locally

Run from the application directory:

    npm ci

Copy .env.example to ignored .env.local and fill only the public URL and publishable key.
The connected project URL is https://lasdaibwrssqnudrtlvf.supabase.co.
Obtain its publishable key from Supabase Project Settings / API Keys.
Do not use a secret or service-role key in the frontend.

    npm start

prestart/prebuild generate an ignored TypeScript config from the two explicitly allowed
variables. Missing configuration fails the command. Tests generate a localhost-only placeholder
so a clean checkout can run tests without live credentials.

When the Vercel integration already supplies production configuration:

    vercel --scope team_62MS6AP7eCva6YWk5INAeOkP env pull .env.cloud.local --environment=production --yes
    node --env-file=.env.cloud.local tools/setup-public-local.cjs

The helper updates only the two public names in .env.local and preserves other local settings.
Vercel redacts production secrets in pulled files; [SENSITIVE] is not a usable database password.

## 2. Inspect and migrate the existing database

The migration is supabase/migrations/202611040001_worklog_documents.sql.
First inspect the live project's existing public tables, functions and policies. Do not reset
the project or overwrite existing worklog objects.

With a locally supplied SUPABASE_DB_URL from Supabase's Connect dialog and a TLS-verified
connection, the checked-in runner supports read-only inspection and an explicit apply:

    node --env-file=.env.database.local tools/worklog-database.mjs
    node --env-file=.env.database.local tools/worklog-database.mjs --apply

The apply path takes a transaction-level advisory lock, checks existing objects, applies the
schema in a transaction and records its checksum. An existing object without a recorded migration
requires review instead of being overwritten. Keep .env.database.local ignored. Never paste
database credentials into documentation, source code or chat.

Alternatively inspect in the authenticated Supabase dashboard SQL Editor and run the migration
there in a transaction. Do not subsequently use the runner's apply command without reconciling
its migration history; the runner deliberately refuses unrecorded existing objects.

## 3. Configure Authentication

Supabase Auth / Providers: enable email/password signup with email confirmation.
Public settings were checked on 2026-11-04: email enabled, signup enabled, autoconfirm false.

Set Site URL to the actual production origin. Allow localhost and approved deployment origins:

- http://localhost:4200/auth**
- https://<production-domain>/auth**
- https://<approved-preview-host>/auth**

Use actual domains from Vercel; prefer explicit preview hosts rather than broad shared-host
wildcards. The app includes returnUrl query parameters on email confirmation/recovery links.
Verify email templates preserve RedirectTo. Configure the project's email delivery provider
before relying on confirmation/recovery delivery. Dashboard redirect and SMTP settings could
not be inspected using the public key.

## 4. Vercel

Reuse the existing linked project; do not create another Supabase resource. The external
Supabase integration is connected. Production variables are present. SUPABASE_URL and
SUPABASE_PUBLISHABLE_KEY were also added to Preview; both environments use this same project.
No privileged database variables are needed by the Angular app.

Keep vercel.json: Angular framework, npm ci, npm run build,
dist/workplace-management-app/browser, and SPA rewrites. Local checked-in settings specify
the intended build even though dashboard defaults showed ng build / dist during inspection.
Confirm the actual deployment build log uses the checked-in settings.

Run checks, deploy a preview only after the database and redirects are configured, verify
the preview, then promote the verified revision to production. Redeploy after environment
changes because these two public values are embedded at build time.

The fetched Vercel onboarding guide was reviewed. CLI 65.11.0 is authenticated; local project
link exists. MCP tools are available, but this connector lacks access to the linked team.
No global plugin installation or unrelated configuration replacement was performed.

## References

- [Vercel Supabase integration](https://vercel.com/marketplace/supabase)
- [Supabase Vercel Marketplace](https://supabase.com/docs/guides/integrations/vercel-marketplace)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Database functions](https://supabase.com/docs/guides/database/functions)
- [Password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Auth redirects](https://supabase.com/docs/guides/auth/redirect-urls)
- [Vercel agent setup](https://vercel.com/get-started.md)
