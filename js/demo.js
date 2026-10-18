// Sample content for demo mode (open the site with ?demo, or before the
// database is connected). These are made-up examples, not real submissions.
const daysAgo = (d, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000).toISOString();

export const demoSeed = {
  profiles: [
    { id: 'u-sample1', username: 'porch_light', bio: 'Collector of things my grandmother said.' },
    { id: 'u-sample2', username: 'second_draft', bio: 'Teacher. Still learning.' },
    { id: 'u-sample3', username: 'riverbend', bio: '' },
  ],
  colors: [
    { slug: 'yellow', name: 'Yellow', meaning: 'The best words and pieces: wisdom that lasted', hex: '#F5D547', sort: 1 },
    { slug: 'blue', name: 'Blue', meaning: 'School and class pieces', hex: '#7FB8E8', sort: 2 },
    { slug: 'green', name: 'Green', meaning: 'Family stories and reflections', hex: '#8FD18A', sort: 3 },
    { slug: 'red', name: 'Red', meaning: 'Passion, love and relationships', hex: '#F28B82', sort: 4 },
    { slug: 'orange', name: 'Orange', meaning: 'Other kinds of pieces', hex: '#F7B267', sort: 5 },
    { slug: 'purple', name: 'Purple', meaning: 'Other kinds of pieces', hex: '#C3A3E6', sort: 6 },
    { slug: 'gray', name: 'Gray', meaning: 'Rough drafts and works in progress', hex: '#BDBDBD', sort: 7 },
  ],
  sources: [
    { slug: 'wisdom-passed-down', name: 'Words of wisdom passed to me', description: 'From a grandparent, a teacher, an elder, a culture', sort: 1 },
    { slug: 'family-motto', name: 'Family mottos', description: 'The things your family always said', sort: 2 },
    { slug: 'people-in-my-life', name: 'People in my life', description: 'Something someone close to you said', sort: 3 },
    { slug: 'helpful-words', name: 'Helpful, useful words', description: 'Lines you actually use', sort: 4 },
    { slug: 'surprising-time', name: 'Words that came in handy at a surprising time', description: 'They showed up right when you needed them', sort: 5 },
    { slug: 'highlights', name: 'Highlights of my day or life', description: 'A line that marks a moment', sort: 6 },
    { slug: 'old-words-young-mouths', name: 'Old words, young mouths', description: 'Wisdom from a child', sort: 7 },
  ],
  pieces: [
    { id: 'demo-q1', author_id: 'u-sample1', kind: 'quote', title: '', body: 'Leave the porch light on. Somebody always comes home late.',
      said_by: 'My grandmother', source_slug: 'family-motto', color: 'green', backdrop: 'aged', stuck_count: 41, created_at: daysAgo(0, 3),
      writeup: 'She said it every night, and she meant it more than once. Years later I caught myself saying it to my own kids before I knew what it meant.' },
    { id: 'demo-q2', author_id: 'u-sample2', kind: 'quote', title: '', body: 'You don\'t have to be finished to be good.',
      said_by: 'My eighth-grade English teacher', source_slug: 'wisdom-passed-down', color: 'blue', backdrop: 'highlight', stuck_count: 33, created_at: daysAgo(1),
      writeup: 'Written in the margin of a draft I almost didn\'t turn in. I teach now, and I write it in margins too.' },
    { id: 'demo-q3', author_id: 'u-sample3', kind: 'quote', title: '', body: 'The river doesn\'t argue with the rock. It just keeps going.',
      said_by: 'A fishing guide on the Suwannee', source_slug: 'surprising-time', color: 'yellow', backdrop: 'dusk', stuck_count: 27, created_at: daysAgo(2),
      writeup: 'Heard it the week I lost a job. He was talking about the current. I wasn\'t.' },
    { id: 'demo-q4', author_id: 'u-sample1', kind: 'quote', title: '', body: 'Grown-ups say "be careful" but they mean "I love you."',
      said_by: 'My son, age 6', source_slug: 'old-words-young-mouths', color: 'yellow', backdrop: 'parchment', stuck_count: 52, created_at: daysAgo(3),
      writeup: 'He said it while I was buckling him in. I haven\'t said "be careful" the same way since.' },
    { id: 'demo-p1', author_id: 'u-sample2', kind: 'piece', title: 'Margins', body: 'Every page I ever loved\nhad something written in the margins —\nnot by the author,\nby whoever read it before me\nand couldn\'t keep quiet.',
      said_by: '', color: 'blue', backdrop: 'aged', stuck_count: 19, created_at: daysAgo(1, 6), writeup: '' },
    { id: 'demo-s1', author_id: 'u-sample3', kind: 'story', title: 'The note in the toolbox', body: 'When my dad passed, I found a folded index card in the lid of his toolbox. It just said: "Measure twice. Call your mother." I don\'t know when he wrote it or who it was for. I keep it in mine now.',
      said_by: '', color: 'green', backdrop: 'aged', stuck_count: 38, created_at: daysAgo(4), writeup: '' },
    { id: 'demo-h1', author_id: 'u-sample1', kind: 'humor', title: 'Dinner rules, Southern edition', body: 'My aunt\'s only rule at Thanksgiving: "If you didn\'t bring a dish, you\'re bringing a story." My uncle brought the same story for eleven years. We\'d have revoked his plate if it weren\'t so good.',
      said_by: '', color: 'orange', backdrop: 'aged', stuck_count: 24, created_at: daysAgo(2, 5), writeup: '' },
    { id: 'demo-k1', author_id: 'u-sample2', kind: 'sketch', title: 'Father and son, the night before he leaves', body: 'DAD: You packed socks?\nSON: Dad.\nDAD: Warm ones. It gets cold up there.\nSON: I\'m going to be fine.\nDAD: (beat) I know. That\'s the part I\'m not ready for.',
      started_at: 'The dad gave a whole speech about being proud. It felt like a greeting card.', aiming_for: 'Say "I love you, I\'ll miss you" without either of them saying it.',
      said_by: '', color: 'red', backdrop: 'aged', stuck_count: 15, created_at: daysAgo(5), writeup: '' },
  ],
  stuck: [],
  highlights: [
    { user_id: 'u-sample2', piece_id: 'demo-q1', color: 'yellow' },
    { user_id: 'u-sample3', piece_id: 'demo-q1', color: 'yellow' },
    { user_id: 'u-sample3', piece_id: 'demo-s1', color: 'yellow' },
    { user_id: 'u-sample1', piece_id: 'demo-k1', color: 'gray' },
  ],
  comments: [
    { id: 1, piece_id: 'demo-q1', author_id: 'u-sample3', body: 'My grandmother kept the porch light on too. Same reason, I think.', created_at: daysAgo(0, 2) },
    { id: 2, piece_id: 'demo-k1', author_id: 'u-sample3', body: 'That last line lands. Maybe cut "Warm ones" so the socks line hangs a beat longer?', created_at: daysAgo(4) },
  ],
};
