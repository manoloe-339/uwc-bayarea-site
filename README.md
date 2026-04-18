# UWC Bay Area — Event Site

Single-page event site for uwcbayarea.org. Built with Next.js 15 + Tailwind.

## Local dev

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Content edits

All event copy lives in **`lib/event.ts`**. Edit that one file to change:

- Date, time, venue
- Speaker names, roles, photos
- Ticket URL (`ticketUrl`)
- Contact email
- Hero body copy

Images live in **`public/`** — swap in new JPGs/PNGs with the same filenames to update photos.

## Deploy to Vercel + GitHub

This project is ready to deploy as-is. Claude Code handoff:

> "Initialize this folder as a git repo. Create a new GitHub repo under my account named `uwc-bayarea-site`, push it. Then deploy to Vercel (my account) and point `uwcbayarea.org` at it — update my DNS records as needed."

### Manual steps if needed

1. `cd uwc-site && git init && git add . && git commit -m "initial"`
2. Create GitHub repo, `git remote add origin …`, `git push -u origin main`
3. In Vercel dashboard: **Add New → Project → Import from GitHub → uwc-bayarea-site**
4. Deploy (zero config — Next.js is auto-detected)
5. **Domains** → add `uwcbayarea.org` and `www.uwcbayarea.org`
6. Update DNS at your registrar per Vercel's instructions (A record `76.76.21.21` for apex, CNAME `cname.vercel-dns.com` for www)

## Structure

```
app/
  layout.tsx     — fonts, OG metadata
  page.tsx       — responsive switch (mobile vs desktop flyer)
  globals.css    — tailwind + tokens
components/
  DesktopFlyer.tsx — fixed-ratio 1:1 flyer for tablet/desktop
  MobileFlyer.tsx  — single-column stack for phones
  TicketCTA.tsx    — shared 'Get Tickets' button
lib/
  event.ts       — single source of truth for event content
public/
  faith.jpg, bhembe.jpg, wabuntu.jpg — speaker photos
  uwc-logo.png   — UWC brand mark
  waterford-bg.jpg — school background texture
  og-image.png   — TODO: generate 1200×630 for social sharing
```

## TODO before going live

- [ ] Replace `ticketUrl` placeholder in `lib/event.ts` with real purchase link
- [ ] Add real `public/og-image.png` (1200×630) for link previews
- [ ] Confirm contact email
- [ ] Test on real iPhone + Android
- [ ] (Optional) add `@vercel/analytics` package for traffic insights
