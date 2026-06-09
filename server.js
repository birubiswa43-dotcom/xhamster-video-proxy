const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());           // Frontend se call karne ke liye
app.use(express.json());

const BASE_URL = 'https://ge.xhamster.desi';

// ================== HOMEPAGE VIDEOS SCRAPE ==================
app.get('/api/videos', async (req, res) => {
    try {
        const page = req.query.page || 1;
        const { data } = await axios.get(`${BASE_URL}/?page=${page}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(data);
        const videos = [];

        // Video cards ko select karo (site ke hisaab se selector adjust kar sakte hain)
        $('a.video-thumb').each((i, el) => {
            const $el = $(el);
            const link = $el.attr('href');
            const title = $el.attr('title') || $el.find('img').attr('alt');
            const thumb = $el.find('img').attr('src') || $el.find('img').attr('data-src');
            const duration = $el.find('.thumb-duration').text().trim();

            if (link && title) {
                videos.push({
                    id: link.split('-').pop() || i,
                    title: title.trim(),
                    thumbnail: thumb.startsWith('http') ? thumb : 'https:' + thumb,
                    duration: duration,
                    videoPageUrl: link.startsWith('http') ? link : BASE_URL + link
                });
            }
        });

        res.json({ videos, page: parseInt(page) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Scraping failed' });
    }
});

// ================== SINGLE VIDEO DETAIL + DIRECT URL ==================
app.get('/api/video', async (req, res) => {
    try {
        const videoUrl = req.query.url;
        if (!videoUrl) return res.status(400).json({ error: 'url required' });

        const { data } = await axios.get(videoUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const $ = cheerio.load(data);
        const title = $('h1').text().trim() || $('title').text();
        const thumb = $('meta[property="og:image"]').attr('content');

        // Direct video source nikaalne ka try (HLS/MP4)
        let directUrl = '';
        $('script').each((i, el) => {
            const scriptContent = $(el).html();
            if (scriptContent && scriptContent.includes('.mp4')) {
                const match = scriptContent.match(/"(https?:\/\/[^"]+\.mp4[^"]*)"/);
                if (match) directUrl = match[1];
            }
        });

        res.json({
            title,
            thumbnail: thumb,
            directVideoUrl: directUrl || null,
            originalPage: videoUrl
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});