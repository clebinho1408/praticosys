---
name: Cloudflare Pages two-factor errors
description: How to preserve actionable 2FA errors when Resend or the Cloudflare edge fails.
---

# 2FA by e-mail behind Cloudflare Pages

**Rule:** never return HTTP `502` for a handled Resend delivery failure behind the custom Cloudflare domain. Return a non-gateway application status (currently `424`) with JSON and surface that JSON in the login form.

**Why:** Cloudflare can replace a `502` response with its own HTML “Bad gateway” page, hiding the application error and making a correctable sender, recipient, rate-limit, or timeout failure look like an origin outage.

**How to apply:**
- The Resend helper must have a short timeout, map safe failure categories to user-facing Portuguese messages, and log only status/cause—not keys, email addresses, or OTPs.
- `RESEND_FROM_EMAIL` is optional; configure it to a verified Resend sender when the default onboarding sender cannot deliver to the intended user.
- Client-wide 401 session clearing must exclude `/auth` and `/verify-otp`, or login/OTP errors reload away before the user can read them.