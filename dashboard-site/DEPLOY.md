# Deploy the dashboard to Vercel

Everything here is a static site. There is no build step.

## Option A: command line (needs Node.js)
1. Open a terminal in this folder.
2. Run: npx vercel
3. Log in when asked. Accept the defaults. If it asks for a framework or build command, say none.
4. Run: npx vercel --prod   (this gives you the permanent address)

## Option B: through GitHub (no command line)
1. Create a GitHub repository and upload everything in this folder to it: index.html, vercel.json, and the css/ and js/ folders.
2. In Vercel: Add New > Project > import that repository.
3. Leave Framework as "Other" and leave build settings empty. Deploy.

## After it is live
- Open the address on your phone and laptop. Type your name on the welcome page, then allow location when asked.
- Folder layout: index.html, css/styles.css, js/app.js, js/theme-init.js. Keep the folders next to index.html.
- To update the page later, replace the changed files and redeploy.
- setup-sync.sql is not part of the website. Run it once in your Supabase SQL Editor if you want sync.

## Installing it as an app
- Android / Chrome / Edge: open the live address, then use Settings > Install Lewsky (or the install icon in the address bar).
- iPhone: open it in Safari, tap Share, then Add to Home Screen.
- The app opens offline with your saved tasks and notes. Weather and radar need a connection.
- If you change any file later, edit CACHE in sw.js (for example lewsky-v2) so installed copies pick up the update.
