// Public settings for the site. Both values are safe to publish:
// the publishable key only allows what the database security rules allow.
// Never put the Supabase secret (service_role) key in this file.
//
export const SUPABASE_URL = 'https://bpdjsxozmwcqhvktpwwa.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_FBVkPP8rYLRnDn9wQOd9aA_VARaftPZ';

// Supabase's JavaScript library, loaded from a CDN (pinned version).
export const SUPABASE_LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

// The "From J. Ray" strip on the homepage. Edit the words here any time.
// Photo: save your picture as img/jray.jpg in the site folder (until then, the initials show).
export const ABOUT = {
  name: 'J. Ray',
  initials: 'JR',
  photo: 'img/jray.jpg',
  headline: 'Hi, I\'m J. Ray.',
  bio: [
    'Writer, teacher, learner, hiker, paddler, Aussiedoodle daddy and ponderer of the little things. I\'ve been a troublesome writer since third grade, when a story about spaghetti and meatballs went up in the school hallway and did not go over well at home.',
    'I started The Yellow Pieces to collect the best words in life: the lines, mottos and stories that stuck with me, and the ones that stuck with you.',
  ],
  signupHeadline: 'A yellow piece now and then',
  signupLine: 'One good line or story in your inbox. No spam, and you can leave anytime.',
};
