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
  'restaurant': { title: 'Google Review Replies for Restaurants', keyword: 'restaurant', desc: 'AI-powered review reply tool built for restaurant owners. Rank higher on Google Maps instantly.' },
  'dentist':    { title: 'Google Review Replies for Dentists', keyword: 'dental clinic', desc: 'Reply to patient reviews professionally. Boost your dental practice ranking on Google Maps.' },
  'hotel':      { title: 'Google Review Replies for Hotels', keyword: 'hotel', desc: 'Hotel review reply generator. Respond to guests and rank higher on Google Maps.' },
  'negative':   { title: 'How to Reply to Negative Google Reviews', keyword: 'unhappy customer', desc: 'Turn bad reviews into trust signals with professional AI-crafted replies.' }
};

app.get('/sitemap.xml', (req, res) => {
  res.header('Content-Type', 'application/xml');
  var xml = '<?xml version="1.0" encoding="UTF-8"?>';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  xml += '<url><loc>https://www.reviewreply.store/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>';
  xml += '<url><loc>https://www.reviewreply.store/restaurant-reviews</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>';
  xml += '<url><loc>https://www.reviewreply.store/dentist-reviews</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>';
  xml += '<url><loc>https://www.reviewreply.store/hotel-reviews</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>';
  xml += '<url><loc>https://www.reviewreply.store/negative-reviews</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>';
  xml += '<url><loc>https://www.reviewreply.store/blog</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>';
  xml += '<url><loc>https://www.reviewreply.store/blog/how-to-reply-to-negative-google-reviews</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>';
  xml += '<url><loc>https://www.reviewreply.store/blog/google-review-response-examples</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>';
  xml += '<url><loc>https://www.reviewreply.store/blog/does-responding-to-reviews-help-seo</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>';
  xml += '</urlset>';
  res.send(xml);
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
    ' Naturally include 1-2 relevant local SEO keywords. Keep reply under 100 words. Output ONLY the reply text, nothing else.';

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
        { role: 'system', content: 'You are a professional business owner replying to a Google review. ' + (toneMap[tone] || toneMap.friendly) + ' Include 1-2 local SEO keywords. Under 100 words. Output ONLY the reply.' },
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('ReviewReply running on ' + PORT));



app.get('/blog', (req, res) => {
  res.render('blog-index', {});
});

app.get('/blog/how-to-reply-to-negative-google-reviews', (req, res) => {
  res.render('blog-negative-reviews', {});
});

app.get('/blog/google-review-response-examples', (req, res) => {
  res.render('blog-review-examples', {});
});

app.get('/blog/does-responding-to-reviews-help-seo', (req, res) => {
  res.render('blog-reviews-seo', {});
});

app.get('/blog', (req, res) => {
  res.render('blog-index', {});
});

app.get('/blog/how-to-reply-to-negative-google-reviews', (req, res) => {
  res.render('blog-negative-reviews', {});
});

app.get('/blog/google-review-response-examples', (req, res) => {
  res.render('blog-review-examples', {});
});

app.get('/blog/does-responding-to-reviews-help-seo', (req, res) => {
  res.render('blog-reviews-seo', {});
});

