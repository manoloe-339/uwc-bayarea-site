# Handoff Prompt for Claude Code

Copy-paste this into `claude` in your terminal, from inside the `uwc-site/` folder:

---

I have a Next.js 15 + Tailwind project in this folder for a UWC Bay Area event page. I need you to:

1. **Install dependencies:** `npm install`
2. **Verify it runs locally:** `npm run dev`, open http://localhost:3000, confirm the flyer renders on desktop and stacks to a single column on mobile (resize browser)
3. **Git + GitHub:**
   - Initialize git repo
   - Create a new public GitHub repo under my account named `uwc-bayarea-site`
   - Push `main`
4. **Deploy to Vercel:**
   - Import the repo into Vercel (my account)
   - Deploy — should be zero-config since it's standard Next.js
5. **Custom domain:**
   - Add `uwcbayarea.org` and `www.uwcbayarea.org` to the Vercel project
   - Update my DNS at the registrar per Vercel's instructions
   - Verify HTTPS cert issues
6. **Report back:**
   - Live URL
   - Preview deployment URL
   - Any DNS propagation waits I need to know about

If you hit type or lint errors during `npm run build`, fix them in place — don't skip the build. The content source of truth is `lib/event.ts`; don't hardcode event copy elsewhere.
