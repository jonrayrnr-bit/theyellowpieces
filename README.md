# The Yellow Pieces

Highlight the best words in your life. The site for theyellowpieces.com.

Built the same way as its sister site, YellowChecklist: a plain website with no
build step (HTML, CSS and JavaScript any static host can serve), hosted on
Cloudflare, with accounts and posts stored in Supabase. It also installs on a
phone like an app (a PWA).

## What's in here

| Path | What it is |
| --- | --- |
| `index.html` | The page shell |
| `css/style.css` | The "Lemon Dusk" look: blue-black ground, cream text, golden lemon; Newsreader + Instrument Sans |
| `js/app.js` | Pages: home (pick-one, featured, trending), sections, a piece, sharing, admin, colors, about, Learn to Write, profile, search, sign-in |
| `js/card.js` | Quote cards: the quote over a background, and the "Save as image" PNG (1080×1350) |
| `js/data.js` | Talks to Supabase (or runs demo mode) |
| `js/config.js` | Supabase project URL and publishable key (both public) |
| `js/demo.js` | Made-up sample pieces for demo mode |
| `supabase/schema.sql` | Database setup: tables, security rules, highlighter colors, quote sources |
| `supabase/update-2026-10-18-launch.sql` | Launch update: photo storage, featured pieces, pick-one pairs and votes, reply counts, admins |
| `supabase/update-2026-10-18-admin-edit.sql` | Lets admins edit any piece's words from the site |
| `demo/photos/` | J. Ray's starter photos, used only in demo mode |
| `manifest.webmanifest`, `sw.js`, `icons/` | What lets it install as a phone app |

## Homepage (launch order)

1. **Which one speaks to you?** Two pieces side by side (a picture against a quote, or two quotes).
   Visitors pick one without signing in, see how others chose, and can say why. Their take posts as a
   reply on the piece they chose. A new pair comes up every 10 seconds until they pick (pausable).
2. **Featured**: the three newest featured pieces.
3. **Trending — Join the conversation**: weighted by replies and "stuck with me", newest first.
4. **Your turn**: the share band, then a row for each section and the Learn to Write teaser.

At launch these are filled with J. Ray's pieces; members' posts take over as they come in.

## Photos

Photos are stored in the Supabase project's `photos` bucket (free plan: 1 GB, about 5 GB of viewing a
month). The admin page (`#/admin`) resizes each photo to 1600 px WebP before uploading; originals stay
on your computer. Quote posts with the words already in the picture are marked so they're always shown
whole, never cropped.

Admins get an **Edit** button on every piece (and in the admin list): change the title, words,
who said it, color and featured, or replace/remove the photo. The downsizer shows the original
and stored size (1200, 1600 or 2048 px) before saving, and keeps the original when it's already small.

## Sections

- **Quotes** — a line from someone's life, shown over a background, with who said it,
  where it came from, and *why it stuck*. Anyone can save the card as an image.
- **Pieces** — original lines, poems, lyrics and prose.
- **Stories** — words that changed something, short or long.
- **Humor** — quips, one-liners and family stories that still get a laugh.
- **Sketches²** (sketches of sketches) — a short scene, what the writer is going for,
  where it started, and notes from readers.
- **Pictures** — photos from along the way (admins post these from the admin page).
- **Learn to Write** — a "coming soon" page for the free writing lessons and worksheets.

Every piece has a highlighter color chosen by the writer (yellow, blue, green, red,
orange, purple, gray), and readers can add their own highlights. "Find by feeling"
filters by color. "This stuck with me" is the site's version of a like.

## One-time setup

1. **Database.** Create a new Supabase project for Yellow Pieces. Open SQL Editor,
   paste all of `supabase/schema.sql`, and click Run.
2. **Keys.** In Supabase, Project Settings → API: copy the Project URL and the
   publishable key into `js/config.js`.
3. **Sign-in emails.** Authentication → URL Configuration: set Site URL to
   `https://theyellowpieces.com` and add `https://theyellowpieces.com/**` and
   `https://theyellowpieces.jonrayrnr.workers.dev/**` under Redirect URLs. Then connect
   Resend (Resend → Settings → Integrations → Supabase) with sender
   `The Yellow Pieces <hello@mail.theyellowpieces.com>`, and paste in the email templates
   from `supabase/email-templates/` (Confirm signup and Magic Link; the subject is in each file's first line).
   The templates must include `{{ .Token }}` — the site signs people in with the emailed code.
4. **Launch update.** In SQL Editor, paste all of `supabase/update-2026-10-18-launch.sql` and click Run.
   Then sign in to the site once, and run the last line of that file with your sign-in email to make
   yourself the admin. The **Admin** link appears next to your username.
5. **Code.** Put this folder in a GitHub repository named `theyellowpieces`.
6. **Hosting.** In Cloudflare, Workers & Pages → Create → import the repository
   (same as YellowChecklist). It deploys to theyellowpieces.com and to a
   `.workers.dev` test address.

## Trying it without the database

Add `?demo` to the address to see the site with sample pieces. Nothing is saved in demo mode.

## Keys

`js/config.js` holds the **publishable** key, which is meant to be public. The
database security rules decide what anyone can do with it. Never put the
Supabase **secret** (service_role) key in this code.
