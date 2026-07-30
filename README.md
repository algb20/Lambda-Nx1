# Pi Payment Support

A minimal [Pi Network](https://minepi.com/) payment page. The frontend
(`index.html`) uses the Pi SDK to authenticate a user and create a 1 Pi payment.
Three serverless endpoints handle the server-side approval flow by calling the
Pi Platform API with your secret **`PI_API_KEY`**:

| Endpoint            | Purpose                                   |
| ------------------- | ----------------------------------------- |
| `POST /api/pi-approve`  | Approve a payment (`onReadyForServerApproval`)   |
| `POST /api/pi-complete` | Complete a payment (`onReadyForServerCompletion`)|
| `POST /api/pi-cancel`   | Cancel a pending payment                  |

The project runs on **Vercel** (functions in `api/`) and still works on
**Netlify** (functions in `netlify/functions/`, reached through the `/api/*`
redirect in `netlify.toml`).

---

## Deploy to Vercel

### Option A — Vercel Dashboard (no install)

1. Go to <https://vercel.com/new> and import this Git repository.
2. Leave the build settings at their defaults (this is a static site with
   `api/` serverless functions — no build step needed).
3. Under **Settings → Environment Variables**, add:
   - `PI_API_KEY` = your app's server API key from the
     [Pi Developer Portal](https://developers.minepi.com/).
4. Deploy. Your functions are live at `/api/pi-approve`, `/api/pi-complete`,
   and `/api/pi-cancel`.

### Option B — Vercel on your computer (CLI)

Install the Vercel CLI globally (this is "Vercel for your computer"):

```bash
npm i -g vercel
```

Then, from the project folder:

```bash
vercel login          # sign in once
vercel env add PI_API_KEY   # paste your Pi API key when prompted
vercel dev            # run the site + functions locally at http://localhost:3000
vercel                # deploy a preview
vercel --prod         # deploy to production
```

> Requires Node.js 18+ (the functions use the built-in global `fetch`).

---

## Environment variables

Copy `.env.example` and fill in your key (do **not** commit the real value):

```
PI_API_KEY=your_pi_server_api_key
```

Set the same variable in your hosting provider's dashboard (Vercel or Netlify).

---

## Notes

- The Pi verification files (`validation-key.txt`,
  `piapp-link-verification.txt`) are served as static files at the site root on
  both platforms.
- The frontend calls `/api/*`; on Netlify those requests are redirected to the
  existing functions in `netlify/functions/` automatically.
