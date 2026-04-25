# Cloud Deployment — Render (backend) + Cloudflare Pages (frontend)

This guide deploys the AttraX hackathon project entirely to free-tier
cloud services. Total time: ~30 minutes. No credit card needed.

## Architecture

```
 user browser
    │
    ├── HTTPS  →  Cloudflare Pages   (static React frontend)
    │              ↓ fetch + WebSocket via VITE_BACKEND_URL
    │
    └── HTTPS  →  Render             (Node + Express + ws)
                   ↓
                OpenRouter API (LLM)
                SiliconFlow API (STT)
```

WebRTC audio is browser-to-browser P2P; only WS signaling traverses Render.

---

## 1. Push to GitHub

The repo at `https://github.com/usopp2023/Spring.git` (branch `main`) is
the source for both Render and Cloudflare Pages. Make sure the latest
voice-on-main branch is pushed there.

## 2. Deploy backend to Render

### 2.1 First-time setup
1. Sign up at https://render.com (GitHub auth — no credit card needed)
2. Top-right → **New +** → **Blueprint**
3. Connect `usopp2023/Spring` (authorize GitHub access)
4. Render reads `render.yaml` automatically; click **Apply**
5. The service `attrax-backend` is provisioned. First deploy takes ~3-5 min.

### 2.2 Set secrets
In the service's **Environment** tab, fill in:
- `OPENROUTER_API_KEY` = your OpenRouter key (`sk-or-v1-...`)
- `SILICONFLOW_API_KEY` = your SiliconFlow key (`sk-...`)
- `ALLOWED_ORIGINS` = leave empty for now; fill after step 3

After saving, Render redeploys automatically (~1 min).

### 2.3 Note the URL
Once deployed, Render gives you a URL like:
```
https://attrax-backend.onrender.com
```
Copy it. You'll need it in step 3.

### 2.4 Free tier caveat
The free plan spins down the service after **15 minutes of inactivity**.
The next request triggers a cold start of ~30 seconds. For a live demo:
- Hit the URL right before demoing to warm it up
- Or upgrade to **Starter** plan ($7/month) for always-on

---

## 3. Deploy frontend to Cloudflare Pages

### 3.1 First-time setup
1. Sign up at https://pages.cloudflare.com
2. **Create a project** → **Connect to Git** → choose `usopp2023/Spring`
3. Configure build settings:
   - **Framework preset**: None (or Vite)
   - **Build command**: `npm install && npm run build -w @attrax/frontend`
   - **Build output directory**: `frontend/dist`
   - **Root directory**: leave empty (repo root)
   - **Node version**: 20 (set via env var `NODE_VERSION=20` if needed)

### 3.2 Set environment variable
In **Settings → Environment variables → Production**:
- `VITE_BACKEND_URL` = `https://attrax-backend.onrender.com` (from step 2.3)

In **Preview** tab as well (for branch deploys), same value.

### 3.3 Deploy
Click **Save and Deploy**. First build ~2 min.

After it finishes, you get a URL like:
```
https://attrax.pages.dev          (production)
https://main.attrax.pages.dev     (branch alias)
```

### 3.4 Wire up CORS
Now go back to Render → backend service → Environment tab:
- `ALLOWED_ORIGINS` = `https://attrax.pages.dev,https://main.attrax.pages.dev`

Save. Render redeploys (~1 min).

---

## 4. Verify

Open `https://attrax.pages.dev` on two devices (or two browser tabs):
- Tab 1: pick S, create a room, set a safe word
- Tab 2: pick M, paste the code, join

Expected:
- ✅ Both tabs land in chat
- ✅ "给我跪好" → M's intensity goes to 2 (LLM via Render → OpenRouter)
- ✅ 📞 → call connects (WebRTC P2P, both on different devices/networks**)
- ✅ Speaking "给我跪好" during call → STT → intensity goes to 2

** WebRTC across cellular networks needs TURN. Without it, only same WiFi /
   same LAN works. For a hackathon demo on stage, ensure both devices are
   on the same WiFi.

---

## 5. Iterating

After making changes locally:
```bash
git push origin main
git push usopp2023 voice-on-main:main
```

Render and Cloudflare Pages both auto-deploy on push to `main`. Render
takes ~1-2 min, Pages ~1-2 min.

---

## Costs

- Render free: $0/month (with cold starts)
- Cloudflare Pages free: $0/month (unlimited builds, 500 builds/month)
- Custom domain (optional): ~10 USD/year

For a black-friday demo: free tier suffices.
