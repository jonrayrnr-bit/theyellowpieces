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
| `css/style.css` | The aged-paper and highlighter look |
| `js/app.js` | Pages: home, sections, a piece, sharing, colors, about, Learn to Write, profile, search, sign-in |
| `js/card.js` | Quote cards: the quote over a background, and the "Save as image" PNG (1080×1350) |
| `js/data.js` | Talks to Supabase (or runs demo mode) |
| `js/config.js` | Supabase project URL and publishable key (both public) |
| `js/demo.js` | Made-up sample pieces for demo mode |
| `supabase/schema.sql` | Database setup: tables, security rules, highlighter colors, quote sources |
| `manifest.webmanifest`, `sw.js`, `icons/` | What lets it install as a phone app |

## Sections

- **Quotes** — a line from someone's life, shown over a background, with who said it,
  where it came from, and *why it stuck*. Anyone can save the card as an image.
- **Pieces** — original lines, poems, lyrics and prose.
- **Stories** — words that changed something, short or long.
- **Humor** — quips, one-liners and family stories that still get a laugh.
- **Sketches²** (sketches of sketches) — a short scene, what the writer is going for,
  where it started, and notes from readers.
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
4. **Code.** Put this folder in a GitHub repository named `theyellowpieces`.
5. **Hosting.** In Cloudflare, Workers & Pages → Create → import the repository
   (same as YellowChecklist). It deploys to theyellowpieces.com and to a
   `.workers.dev` test address.

## Trying it without the database

Add `?demo` to the address to see the site with sample pieces. Nothing is saved in demo mode.

## Keys

`js/config.js` holds the **publishable** key, which is meant to be public. The
database security rules decide what anyone can do with it. Never put the
Supabase **secret** (service_role) key in this code.
