# Deployment

Horizon is configured for Vercel with:

- Framework: Vite
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

Production Supabase browser configuration is provided through `.env.production`.
Only the public Supabase project URL and publishable key are exposed to the Vite bundle.

The production project is expected to deploy automatically from the `main` branch.
