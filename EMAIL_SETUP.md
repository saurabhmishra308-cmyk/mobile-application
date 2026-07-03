# SendGrid email + info@envirolytics.in — DNS setup

Envirolytics Monitor sends all report emails **from `info@envirolytics.in`**
via SendGrid. To keep those emails out of the spam folder you MUST add the
records below to the `envirolytics.in` DNS zone.

---

## Step 1 — Get a SendGrid API key

1. Sign up (free) at https://sendgrid.com/ and verify your account email.
2. In the SendGrid dashboard go to **Settings → API Keys → Create API Key**.
3. Name it `Envirolytics Monitor`, choose **Restricted Access → Mail Send: Full Access**.
4. Copy the key (starts with `SG.`). You'll never see it again.
5. Paste it into `/app/backend/.env`:
   ```
   SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx
   ```
6. Restart the backend: `sudo supervisorctl restart backend`.

---

## Step 2 — Verify `info@envirolytics.in` as a single sender (fast path)

1. SendGrid dashboard → **Settings → Sender Authentication → Single Sender Verification**.
2. Add sender `info@envirolytics.in`, fill in your company address, and confirm the verification email that arrives at `info@envirolytics.in`.

That alone is enough to start sending — but emails may land in spam because SPF/DKIM are not set. Do Step 3 next to fix that.

---

## Step 3 — Domain authentication (SPF + DKIM + DMARC)

In SendGrid dashboard → **Settings → Sender Authentication → Authenticate Your Domain**, choose `envirolytics.in`, disable link branding for the mobile app for now, and SendGrid will show you **3 CNAME records** to add. They look like this (yours will differ):

| Host | Type | Value |
| --- | --- | --- |
| `s1._domainkey.envirolytics.in` | CNAME | `s1.domainkey.uXXXXX.wl.sendgrid.net.` |
| `s2._domainkey.envirolytics.in` | CNAME | `s2.domainkey.uXXXXX.wl.sendgrid.net.` |
| `em1234.envirolytics.in` | CNAME | `uXXXXX.wl.sendgrid.net.` |

Add all three CNAMEs in your DNS provider's control panel (same place where you added `mobileapp` in `DOMAIN_SETUP.md`). Wait ~15 minutes, then click **Verify** in SendGrid.

Optionally add these two records for stronger deliverability:

| Host | Type | Value |
| --- | --- | --- |
| `envirolytics.in` | TXT | `v=spf1 include:sendgrid.net -all` |
| `_dmarc.envirolytics.in` | TXT | `v=DMARC1; p=none; rua=mailto:info@envirolytics.in` |

*If you already send email from Google Workspace / Zoho / Microsoft 365 through `envirolytics.in`, edit the existing `v=spf1` line and add `include:sendgrid.net` to it — do not create a second SPF record.*

---

## Step 4 — Test

```bash
curl -X POST https://<your-mobile-app-backend>/api/email-report \
  -H 'Content-Type: application/json' \
  -d '{
    "recipient": "your.address@gmail.com",
    "envirolytics_token": "<paste a fresh JWT from /api/auth/login>",
    "kinds": ["flowmeter_csv"]
  }'
```

Response should be `{"status":"sent","recipient":"...","count":1}` and you should receive an email from `info@envirolytics.in` with the CSV attached.

---

## What already runs automatically

Once `SENDGRID_API_KEY` is set:

- **On-demand** — every "Send by email" button in the mobile app fires `POST /api/email-report`.
- **Weekly** — every Monday 06:00 IST the backend cron picks up all users who ticked "Weekly report" in the app's Profile → Email Reports section and mails them `flowmeter_csv + flowmeter_pdf + dwlr_csv + dwlr_pdf` covering the last 7 days.
- **Monthly** — same, on the 1st of every month at 06:00 IST, covering the last 30 days.

Users opt-in from **Profile → Email Reports** with the two toggles.
