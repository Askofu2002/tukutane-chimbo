# Tukutane Chimbo

Bilingual (English / Kiswahili) dating and connections app foundation for Tanzania, built with Next.js and Supabase.

## Included

- Next.js App Router + TypeScript foundation.
- Supabase email/password sign-up and sign-in.
- Profile editing and discovery of completed profiles.
- English / Kiswahili interface toggle.
- Female profile photo upload flow: exactly three images, JPG/PNG/WEBP, max 5 MB each, stored in the private `profile-photos` bucket.
- Tanzania region selector and responsive mobile layout.
- Basic environment health endpoint.

## Supabase configuration

The project owner has installed and verified the nine database tables and private `profile-photos` bucket.

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL=https://menfrcasircrrivkaisp.supabase.co`.
3. Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the Supabase publishable key.
4. In Supabase Authentication settings, configure the Site URL and allowed redirect URLs for local and production domains.
5. Check whether email confirmation is enabled; if enabled, confirm the email before signing in.

Do not commit secrets. Never put a Supabase service-role key or AzamPay secret in a `NEXT_PUBLIC_*` variable.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Important implementation status

This is a committed application foundation, not a production-complete service. The following still need to be implemented and tested:

- Secure conversation creation/invitations and full realtime messaging.
- Block/report user workflows and admin moderation dashboard.
- Server-side AzamPay sandbox checkout, verified callbacks, idempotency, and membership activation.
- Membership renewals, revenue reporting, and admin payouts.
- Phone OTP, age/consent checks, privacy controls, anti-abuse controls, and security review.
- Hosting, domain configuration, Android packaging, signing, and APK release.

The app does not simulate payment success. A membership must only activate after a trusted server verifies the transaction with AzamPay. Do not add merchant secrets to frontend code or GitHub.

## Deployment

Deploy to a Next.js-compatible host such as Vercel. Add the two Supabase environment variables in the host settings before deploying. A GitHub push alone does not mean the app is hosted; confirm a successful build and test the deployed URL.

## Database

The SQL installation script was supplied separately as `tukutane-chimbo-supabase-schema.sql`. Review any SQL changes before applying them to a database containing production data.
