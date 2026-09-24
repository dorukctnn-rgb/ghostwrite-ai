const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

const users = {};

const SEO_PAGES = {
  'restaurant': {
    slug: 'restaurant', title: 'Google Review Replies for Restaurants', keyword: 'restaurant',
    desc: 'Reply to diners\' Google reviews in seconds: thank regulars, answer complaints about waits or orders, and show future guests you listen.',
    tipsTitle: 'What a good restaurant reply does',
    tips: [
      'Mention the dish, the occasion or the staff member the guest named, so the reply is clearly not a template.',
      'For waits, wrong orders or cold food: apologise once, say what you changed, and invite them back by name.',
      'Never argue about taste in public. Offer to talk offline and give a direct contact.',
      'Reply to the good ones too. Regulars notice, and future diners read the tone of the whole page.'
    ]
  },
  'dentist': {
    slug: 'dentist', title: 'Google Review Replies for Dentists', keyword: 'dental clinic',
    desc: 'Reply to patient reviews professionally and without revealing anything about their care. Friendly for praise, careful for complaints.',
    tipsTitle: 'Replying to patient reviews safely',
    tips: [
      'Do not confirm that the reviewer is a patient or mention any treatment. Health privacy rules (such as HIPAA in the US or GDPR in the UK and EU) still apply in public replies.',
      'Thank people for feedback in general terms, and invite them to call the practice to discuss anything specific.',
      'For complaints about waiting times or billing, acknowledge the frustration and give a named contact, without discussing details.',
      'Always read the generated reply before posting and remove anything that could identify a patient.'
    ]
  },
  'hotel': {
    slug: 'hotel', title: 'Google Review Replies for Hotels', keyword: 'hotel',
    desc: 'Reply to guest reviews in their own language, thank them for specifics, and handle complaints about rooms, noise or check-in calmly.',
    tipsTitle: 'What a good hotel reply does',
    tips: [
      'Reply in the guest\'s language. ReviewReply writes in the language of the review.',
      'Name what they enjoyed (the view, breakfast, a staff member) and invite them back for a specific reason.',
      'For complaints, say what was fixed (the air conditioning, the noise policy) rather than only apologising.',
      'Keep it short. Future guests skim replies to judge how you handle problems.'
    ]
  },
  'negative': {
    slug: 'negative', title: 'How to Reply to Negative Google Reviews', keyword: 'unhappy customer',
    desc: 'Write calm, specific replies to negative Google reviews. Apologise once, explain what changed, and take the conversation offline.',
    tipsTitle: 'The four parts of a good reply to a bad review',
    tips: [
      'Thank them for the feedback, even when it stings.',
      'Apologise for their experience once, without excuses.',
      'Say what you have done or will do about it, specifically.',
      'Offer a direct contact to put it right, and leave it there. Do not argue in public.'
    ]
  }
};

const SITEMAP_PATHS = ['/', '/restaurant-reviews', '/dentist-reviews', '/hotel-reviews', '/negative-reviews', '/blog',
  '/blog/how-to-respond-to-google-reviews', '/blog/how-to-reply-to-negative-google-reviews', '/blog/negative-review-response-templates',
  '/blog/google-review-response-examples', '/blog/google-review-reply-examples-restaurants', '/blog/does-responding-to-reviews-help-seo'];

app.get('/sitemap.xml', (req, res) => {
  res.header('Content-Type', 'application/xml');
  var xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  SITEMAP_PATHS.forEach(function (p) { xml += '<url><loc>https://www.reviewreply.store' + p + '</loc><lastmod>2026-09-24</lastmod></url>'; });
  res.send(xml + '</urlset>');
});

app.get('/googlefcff82c355800720.html', (req, res) => { res.send('google-site-verification: googlefcff82c355800720.html'); });
app.get('/robots.txt', (req, res) => {
  res.header('Content-Type', 'text/plain');
  res.send('User-agent: *\nAllow: /\nSitemap: https://www.reviewreply.store/sitemap.xml');
});

app.get('/', (req, res) => {
  const isPro = req.cookies.pro === 'true';
  res.render('index', { result: '', review: '', email: '', isPro, page: null });
});

Object.keys(SEO_PAGES).forEach(slug => {
  app.get('/' + slug + '-reviews', (req, res) => {
    const isPro = req.cookies.pro === 'true';
    res.render('index', { result: '', review: '', email: '', isPro, page: SEO_PAGES[slug] });
  });
});

app.post('/generate', async (req, res) => {
  const { review, email, tone } = req.body;
  const isPro = users[email] && users[email].pro === true ? true : req.cookies.pro === 'true';

  if (!review || review.trim().length < 5) {
    return res.render('index', { result: 'Please paste a customer review first.', review: '', email: email || '', isPro, page: null });
  }

  if (!isPro && review.length > 300) {
    return res.render('index', { result: 'FREE_LIMIT', review, email: email || '', isPro: false, page: null });
  }

  var toneMap = {
    friendly: 'Be warm, friendly and personal.',
    professional: 'Be formal, concise and professional.',
    witty: 'Be clever, a little witty but still respectful.',
    empathetic: 'Be deeply empathetic, apologetic where needed, and solution-focused.'
  };

  var systemPrompt = 'You are a professional business owner replying to a customer Google review. ' +
    (toneMap[tone] || toneMap.friendly) +
    ' Reply in the same language as the review. Naturally mention the type of business once where it fits. Keep reply under 100 words. Output ONLY the reply text, nothing else.';

  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: review }
      ],
      temperature: 0.75,
      max_tokens: 200
    }, {
      headers: {
        'Authorization': 'Bearer ' + process.env.GROQ_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const result = response.data.choices[0].message.content.trim();
    res.render('index', { result, review, email: email || '', isPro, page: null });

  } catch (err) {
    console.error('Groq error:', err.message);
    res.render('index', { result: 'Service error. Please try again.', review, email: email || '', isPro, page: null });
  }
});

app.post('/generate-ext', async (req, res) => {
  const { review, email, tone } = req.body;
  const isPro = users[email] && users[email].pro === true;

  if (!review || review.trim().length < 5) return res.json({ error: 'No review text.' });
  if (!isPro && review.length > 300) return res.json({ upgrade: true });

  var toneMap = {
    friendly: 'Be warm, friendly and personal.',
    professional: 'Be formal, concise and professional.',
    witty: 'Be clever, a little witty but still respectful.',
    empathetic: 'Be deeply empathetic, apologetic where needed, and solution-focused.'
  };

  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a professional business owner replying to a Google review. ' + (toneMap[tone] || toneMap.friendly) + ' Reply in the same language as the review. Naturally mention the type of business once where it fits. Under 100 words. Output ONLY the reply.' },
        { role: 'user', content: review }
      ],
      temperature: 0.75,
      max_tokens: 200
    }, {
      headers: { 'Authorization': 'Bearer ' + process.env.GROQ_API_KEY, 'Content-Type': 'application/json' }
    });
    res.json({ reply: response.data.choices[0].message.content.trim() });
  } catch (e) {
    res.json({ error: 'AI error.' });
  }
});

app.post('/webhook', (req, res) => {
  try {
    const event = req.body;
    console.log('WEBHOOK RECEIVED:', JSON.stringify(event));
    const email = event.email || (event.data && event.data.attributes && event.data.attributes.user_email);
    if (email) {
      users[email] = { pro: true };
      console.log('NEW PRO USER:', email);
    }
  } catch (e) {
    console.error('Webhook error:', e.message);
  }
  res.sendStatus(200);
});

app.get('/pro', (req, res) => {
  res.cookie('pro', 'true', { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
  res.redirect('/');
});

const BLOG = {
  '/blog': 'blog-index',
  '/blog/how-to-reply-to-negative-google-reviews': 'blog-negative-reviews',
  '/blog/google-review-response-examples': 'blog-review-examples',
  '/blog/does-responding-to-reviews-help-seo': 'blog-reviews-seo',
  '/blog/how-to-respond-to-google-reviews': 'blog-respond-reviews',
  '/blog/google-review-reply-examples-restaurants': 'blog-restaurant-examples',
  '/blog/negative-review-response-templates': 'blog-negative-templates'
};
Object.keys(BLOG).forEach(function (route) {
  app.get(route, (req, res) => res.render(BLOG[route], {}));
});

app.use((req, res) => res.status(404).send('<!doctype html><meta name="viewport" content="width=device-width"><title>Not found | ReviewReply</title><link rel="stylesheet" href="/rr.css"><div class="container"><h1>Page not found</h1><p><a href="/">Go to the review reply generator</a></p></div>'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('ReviewReply running on ' + PORT));
