const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const BASE_URL = 'https://ge.xhamster.desi';

// Improved Homepage Scraper
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

        // Better broad selectors for current xhamster structure
        $('a[href*="/videos/"]').each((i, el) => {
            const $el = $(el);
            const link = $el.attr('href');
            const title = $el.attr('title') || $el.find('img').attr('alt') || $el.text().trim();
            let thumb = $el.find('img').attr('src') || $el.find('img').attr('data-src') || $el.find('source').attr('srcset');

            const durationEl = $el.find('.duration, .thumb-duration, span').filter((i, el) => $(el).text().match(/^\d+:\d+$/));
            const duration = durationEl.text().trim() || '00:00';

            if (link && title && title.length > 5) {
                if (thumb && !thumb.startsWith('http')) thumb = 'https:' + thumb;
                videos.push({
                    id: i + 1,
                    title: title.trim().substring(0, 80),
                    thumbnail: thumb || 'https://via.placeholder.com/400x225?text=No+Thumb',
                    duration: duration,
                    videoPageUrl: link.startsWith('http') ? link : BASE_URL + link
                });
            }
        });

        // Remove duplicates
        const uniqueVideos = videos.filter((v, index, self) => 
            index === self.findIndex(t => t.videoPageUrl === v.videoPageUrl)
        );

        res.json({ success: true, videos: uniqueVideos.slice(0, 24), page: parseInt(page) });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Single Video Details
app.get('/api/video', async (req, res) => {
    try {
        let videoUrl = req.query.url;
        if (!videoUrl) return res.status(400).json({ success: false, error: 'url required' });

        if (!videoUrl.startsWith('http')) videoUrl = BASE_URL + videoUrl;

        const { data } = await axios.get(videoUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });

        const $ = cheerio.load(data);
        const title = $('h1').first().text().trim() || $('title').text().split('|')[0];
        const thumbnail = $('meta[property="og:image"]').attr('content');

        let directVideoUrl = '';
        // Search for mp4 in scripts
        $('script').each((i, el) => {
            const content = $(el).html();
            if (content && (content.includes('.mp4') || content.includes('videoUrl'))) {
                const match = content.match(/"(https?:\/\/[^"]+\.mp4[^"]*)"/i);
                if (match) directVideoUrl = match[1];
            }
        });

        res.json({
            success: true,
            title: title,
            thumbnail: thumbnail,
            directVideoUrl: directVideoUrl || null,
            originalPage: videoUrl
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
