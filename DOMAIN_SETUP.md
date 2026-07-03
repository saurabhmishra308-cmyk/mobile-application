# Setting up `mobileapp.envirolytics.in` for your mobile app

You already own `envirolytics.in`. To link the mobile app to a new subdomain
`mobileapp.envirolytics.in` (used for iOS Universal Links, Android App Links,
and – if you want – hosting the marketing / "Get the app" landing page), follow
these three steps in order.

---

## Step 1 — Add the DNS record

1. Log in to the control panel where `envirolytics.in` is registered
   (GoDaddy, BigRock, Cloudflare, AWS Route 53, Namecheap, Hostinger — the
   provider that shows "Nameservers" for `envirolytics.in`).
2. Open **DNS management** for `envirolytics.in`.
3. Add a new **CNAME** record:

   | Field | Value |
   | --- | --- |
   | Type  | `CNAME` |
   | Host / Name | `mobileapp` |
   | Points to / Target / Value | *(the domain given by Emergent after Publish — see Step 2)* |
   | TTL | `Auto` or `3600` |

   If your DNS provider does not allow CNAME at a subdomain, use an **A record**
   pointing to the IP given by Emergent instead.

4. Save. DNS usually propagates in 5 – 60 minutes. Verify with:
   ```
   dig mobileapp.envirolytics.in +short
   ```

---

## Step 2 — Attach the subdomain in Emergent

1. In this Emergent workspace, click the **Publish** button (top-right).
2. During publish, choose **"Custom domain"** and enter
   `mobileapp.envirolytics.in`. Emergent will show you the target hostname / IP
   to place in the CNAME record from Step 1.
3. Emergent auto-provisions a Let's Encrypt TLS certificate for the subdomain
   (may take a minute after DNS propagates). Once the cert is live, browsing to
   `https://mobileapp.envirolytics.in/` will show the app landing page.

---

## Step 3 — Publish the deep-link association files

For iOS Universal Links and Android App Links to open the app automatically
when a customer taps `https://mobileapp.envirolytics.in/*`, you must serve two
files at fixed paths **from the subdomain over HTTPS** (they must be reachable
without redirects).

### 3a — `https://mobileapp.envirolytics.in/.well-known/apple-app-site-association`

Content-Type: `application/json` (**no `.json` extension in the URL**).

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appIDs": ["<TEAM_ID>.in.envirolytics.mobile"],
        "components": [
          { "/": "*", "comment": "Open every path in the app" }
        ]
      }
    ]
  }
}
```
- Replace `<TEAM_ID>` with the 10-character Apple Team ID visible in
  App Store Connect → Membership.
- No trailing whitespace, must be served with `Content-Type: application/json`.

### 3b — `https://mobileapp.envirolytics.in/.well-known/assetlinks.json`

Content-Type: `application/json`.

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "in.envirolytics.mobile",
      "sha256_cert_fingerprints": [
        "<SHA256_FINGERPRINT_FROM_SIGNED_BUILD>"
      ]
    }
  }
]
```
- The SHA-256 fingerprint comes from the release-signed APK/AAB. After the
  first Emergent-produced Android build, run
  `keytool -list -v -keystore <keystore>.jks` (or use
  `gradle signingReport`) to obtain it.

### 3c — Test the linking

```bash
curl -s https://mobileapp.envirolytics.in/.well-known/apple-app-site-association | head
curl -s https://mobileapp.envirolytics.in/.well-known/assetlinks.json | head
```
Both should return HTTP 200 with the JSON above (no redirect, no HTML).

You can also use Apple's validator:
`https://search.developer.apple.com/appsearch-validation-tool/`

And Google's validator:
`https://developers.google.com/digital-asset-links/tools/generator`

---

## Optional — Marketing landing page

`https://mobileapp.envirolytics.in/` currently redirects to the app preview.
If you want it to show a "Download on the App Store / Google Play" landing
page instead, just add an `index.html` to the deployment (or ask us to
generate one). The deep-link association files must still live under
`/.well-known/…` regardless of what you serve at `/`.

---

## Recap

| Task | Where | Owner |
| --- | --- | --- |
| Add CNAME `mobileapp` → Emergent target | Your DNS provider | You |
| Attach subdomain during Publish | Emergent Publish button | You (5 minutes) |
| Host `apple-app-site-association` | `https://mobileapp.envirolytics.in/.well-known/` | You (paste the JSON above) |
| Host `assetlinks.json` | Same folder | You (after first signed Android build) |
| Universal-Link / App-Link config in `app.json` | `frontend/app.json` | Already done ✅ |

Once these are live, tapping any `https://mobileapp.envirolytics.in/*` link
from Mail, WhatsApp, Safari, Chrome, etc. will open the Envirolytics Monitor
app directly.
