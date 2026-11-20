# Deploy the dashboard to Vercel

Everything here is a static site. There is no build step.

## Option A: command line (needs Node.js)
1. Open a terminal in this folder.
2. Run: npx vercel
3. Log in when asked. Accept the defaults. If it asks for a framework or build command, say none.
4. Run: npx vercel --prod   (this gives you the permanent address)

## Option B: through GitHub (no command line)
1. Create a GitHub repository and upload index.html and vercel.json to it.
2. In Vercel: Add New > Project > import that repository.
3. Leave Framework as "Other" and leave build settings empty. Deploy.

## After it is live
- Open the address on your phone and laptop. Allow location when asked.
- To update the page later, replace index.html and redeploy.
- setup-sync.sql is not part of the website. Run it once in your Supabase SQL Editor if you want sync.
