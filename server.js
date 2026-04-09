const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.set('view engine', 'ejs');
app.use(express.json());

const businessData = {
    name: "Antalya Premium Resort",
    reviews: [
        { id: 1, author: "Mert", rating: 5, text: "Otel şahaneydi, garsonlar çok ilgiliydi.", date: "1s önce" },
        { id: 2, author: "Helga", rating: 4, text: "Great view but the coffee was expensive.", date: "5s önce" }
    ]
};

app.get('/', (req, res) => res.render('index'));
app.get('/dashboard', (req, res) => res.render('dashboard', { businessName: businessData.name, reviews: businessData.reviews }));
app.get('/free-tool', (req, res) => res.render('free-tool'));

// LEMONSQUEEZY PRICING ROUTE
app.get('/pricing', (req, res) => {
    res.render('pricing', {
        // Bu linkleri LemonSqueezy panelinden alıp buraya yapıştıracaksın
        starterCheckout: "https://reviewghost.lemonsqueezy.com/checkout/buy/STARTER_LINK",
        proCheckout: "https://reviewghost.lemonsqueezy.com/checkout/buy/PRO_LINK"
    });
});

app.post('/generate-reply', async (req, res) => {
    const { reviewText, tone, specialInstructions } = req.body;
    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "system", content: \Sen bir SEO uzmanısın. \ bir tonla cevap yaz. Ekstra talimat: \\ }, { role: "user", content: reviewText }]
        }, { headers: { 'Authorization': 'Bearer ' + process.env.GROQ_API_KEY } });
        res.json({ success: true, reply: response.data.choices[0].message.content });
    } catch (e) { res.json({ success: false, reply: "Hata oluştu." }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('🚀 ReviewGhost Final Engine Running!'));
