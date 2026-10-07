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
app.set('trust proxy', 1); // Render + Cloudflare terminate TLS

// === Paid plans: Gumroad license keys ===
// A paid plan is a Gumroad license key, checked with POST /v2/licenses/verify (no secret
// needed) and kept in an httpOnly cookie. Both products need "Generate a unique license
// key per sale" switched on in Gumroad, otherwise no purchase can be verified.
const STARTER_PRODUCT_ID = 'Rv2ra2BwPeukaj2zt5cdPA=='; // dorukctn.gumroad.com/l/qkcxwv
const PRO_PRODUCT_ID = '2yRWEPchuLyJD9K6idd_Tw==';     // dorukctn.gumroad.com/l/wyaezo
const LICENSE_COOKIE = 'rr_license';
const licenseCache = new Map();

async function verifyLicense(rawKey) {
  const key = String(rawKey || '').trim();
  if (!key || key.length > 100) return { ok: false, reason: 'Enter the license key from your Gumroad receipt.' };
  const hit = licenseCache.get(key);
  if (hit && hit.until > Date.now()) return hit.result;

  let result = { ok: false, reason: 'That license key was not found. Copy it again from your Gumroad receipt.' };
  let reached = false;
  for (const productId of [STARTER_PRODUCT_ID, PRO_PRODUCT_ID]) {
    try {
      const r = await axios.post('https://api.gumroad.com/v2/licenses/verify',
        new URLSearchParams({ product_id: productId, license_key: key, increment_uses_count: 'false' }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 8000, validateStatus: () => true });
      reached = true;
      const d = r.data || {};
      if (!d.success || !d.purchase) continue;
      const p = d.purchase;
      if (p.refunded || p.chargebacked || (p.disputed && !p.dispute_won)) {
        result = { ok: false, reason: 'This purchase was refunded or disputed.' };
      } else if (p.subscription_ended_at || p.subscription_failed_at) {
        result = { ok: false, reason: 'This subscription has ended. Renew it on Gumroad to keep the paid plan.' };
      } else {
        result = { ok: true, plan: productId === PRO_PRODUCT_ID ? 'pro' : 'starter' };
      }
      break;
    } catch (e) {
      console.error('Gumroad verify error:', e.message);
    }
  }
  if (!reached) return { ok: false, reason: 'Could not reach Gumroad. Please try again in a minute.' };
  licenseCache.set(key, { result, until: Date.now() + (result.ok ? 6 * 3600e3 : 10 * 60e3) });
  return result;
}

async function isPaid(req) {
  const key = req.cookies && req.cookies[LICENSE_COOKIE];
  if (!key) return false;
  return (await verifyLicense(key)).ok;
}

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
  SITEMAP_PATHS.forEach(function (p) { xml += '<url><loc>https://www.reviewreply.store' + p + '</loc><lastmod>' + (p.indexOf('/blog') === 0 ? '2026-09-24' : '2026-10-07') + '</lastmod></url>'; });
  res.send(xml + '</urlset>');
});

app.get('/googlefcff82c355800720.html', (req, res) => { res.send('google-site-verification: googlefcff82c355800720.html'); });
app.get('/robots.txt', (req, res) => {
  res.header('Content-Type', 'text/plain');
  res.send('User-agent: *\nAllow: /\nSitemap: https://www.reviewreply.store/sitemap.xml');
});

app.get('/', async (req, res) => {
  const isPro = await isPaid(req);
  res.render('index', { result: '', review: '', email: '', isPro, page: null });
});

Object.keys(SEO_PAGES).forEach(slug => {
  app.get('/' + slug + '-reviews', async (req, res) => {
    const isPro = await isPaid(req);
    res.render('index', { result: '', review: '', email: '', isPro, page: SEO_PAGES[slug] });
  });
});

app.post('/generate', async (req, res) => {
  const { review, tone } = req.body;
  const email = '';
  const isPro = await isPaid(req);

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
  const { review, tone } = req.body;

  if (!review || review.trim().length < 5) return res.json({ error: 'No review text.' });
  if (review.length > 300 && !(await verifyLicense(req.body.license_key || req.body.license)).ok) return res.json({ upgrade: true });

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

// Sale pings are acknowledged but grant nothing: anyone can POST here, so access
// comes only from a license key that Gumroad verifies (see /pro).
app.post('/webhook', (req, res) => {
  const b = req.body || {};
  console.log('Sale ping:', { sale_id: b.sale_id, product_id: b.product_id, has_license: Boolean(b.license_key) });
  res.sendStatus(200);
});

// Activate a paid plan with the license key from the Gumroad receipt.
app.get('/pro', async (req, res) => {
  res.render('activate', { error: '', active: await isPaid(req) });
});

app.post('/pro', async (req, res) => {
  const key = String(req.body.license_key || '').trim();
  const check = await verifyLicense(key);
  if (!check.ok) return res.status(400).render('activate', { error: check.reason, active: false });
  res.clearCookie('pro');
  res.cookie(LICENSE_COOKIE, key, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax', secure: req.secure });
  res.redirect(303, '/?activated=1#tool');
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
