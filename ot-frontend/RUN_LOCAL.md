# OT Frontend - Local Development Quick Start

## Prerequisites
- Node.js 18+
- npm or yarn

## Installation

```bash
cd /path/to/ot/frontend

# Install dependencies
npm install
```

## Run Development Server

```bash
npm run dev
```

Server starts on: **http://localhost:3002**

---

## Environment Files

### Local Development (`.env.local`)
- Uses **mock authentication** (no SSO needed)
- Connects to backend on `http://localhost:8085`
- Auto-login with test user

**Auto-activated** when running `npm run dev`

### Production (`.env`)
- Uses **real SSO** via Directory backend
- Connects to `https://api-ot.zenohosp.com`
- Real authentication required

**Used** when running `npm run build`

---

## Build for Production

```bash
npm run build
```

Output: `dist/` folder (ready for deployment)

---

## Run Production Build Locally

```bash
npm run build
npm run preview
```

---

## Environment Variables

### What Each Variable Does

| Variable | Purpose | Local | Prod |
|----------|---------|-------|------|
| `VITE_API_BASE_URL` | Backend API URL | `http://localhost:8085` | `https://api-ot.zenohosp.com` |
| `VITE_DIRECTORY_API_URL` | Directory SSO URL | `http://localhost:9000` | `https://api-directory.zenohosp.com` |
| `VITE_COOKIE_DOMAIN` | SSO cookie domain | `localhost` | `.zenohosp.com` |
| `VITE_DEV_MOCK_AUTH` | Skip real SSO | `true` | `false` |
| `VITE_MOCK_HOSPITAL_ID` | Test hospital ID | `e1b924ba-3cac-426d-a775-3c978fd95490` | N/A |
| `VITE_MOCK_JWT` | Test JWT token | (long token) | N/A |

---

## Troubleshooting

### Port 3002 Already in Use
```bash
# Find process using port 3002
lsof -ti:3002

# Kill it
kill -9 <PID>

# Or use a different port in vite.config.js
```

### API Calls Failing (401/403)
- Ensure OT backend is running on port 8085
- Check `VITE_API_BASE_URL` in `.env.local` or `.env`
- Verify mock auth is enabled: `VITE_DEV_MOCK_AUTH=true`

### CSS/Tailwind Not Loading
```bash
# Clear Vite cache
rm -rf node_modules/.vite

# Reinstall
npm install

# Restart dev server
npm run dev
```

### Module Not Found Errors
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

---

## Development Tips

### Debug Network Requests
- Open DevTools (F12)
- Go to Network tab
- Watch API calls to `http://localhost:8085`

### Debug Mock Auth
- DevTools → Application → Cookies
- Look for `sso_token` cookie
- It contains the mock JWT token

### Hot Module Reload (HMR)
- Changes save automatically
- Page reloads instantly
- No need to restart `npm run dev`

---

## File Structure

```
src/
  App.jsx                  # Main router
  main.jsx                 # Entry point
  index.css                # Tailwind + global styles
  pages/
    Login.jsx              # SSO login page
    SsoCallback.jsx        # OAuth2 callback
    Dashboard.jsx          # Stats cards
    OtBoard.jsx            # Room schedule grid
    Bookings.jsx           # Booking table
    BookingDetail.jsx      # Single booking + status controls
  components/
    Layout.jsx             # Sidebar navigation
    ProtectedRoute.jsx     # Auth guard
  context/
    AuthContext.jsx        # Session management
  api/
    client.js              # Axios instance + API methods
```

---

## Production Deployment

1. Build the app:
   ```bash
   npm run build
   ```

2. Deploy `dist/` folder to:
   - Vercel (recommended)
   - Netlify
   - AWS S3 + CloudFront
   - Docker container
   - Any static hosting

3. Set environment variables in your hosting platform:
   ```
   VITE_API_BASE_URL=https://api-ot.zenohosp.com
   VITE_DIRECTORY_API_URL=https://api-directory.zenohosp.com
   VITE_COOKIE_DOMAIN=.zenohosp.com
   VITE_DEV_MOCK_AUTH=false
   ```

4. Ensure DNS points to your frontend URL: `ot.zenohosp.com`
