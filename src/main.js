// Goodreads Book Scraper - CheerioCrawler implementation
import { Actor, log } from 'apify';
import { CheerioCrawler, Dataset } from 'crawlee';
import { load as cheerioLoad } from 'cheerio';

// Single-entrypoint main
await Actor.init();

async function main() {
    try {
        const input = (await Actor.getInput()) || {};
        const {
            shelf = 'fantasy',
            results_wanted: RESULTS_WANTED_RAW = 100,
            max_pages: MAX_PAGES_RAW = 999,
            collectDetails = true,
            startUrl,
            startUrls,
            url,
            proxyConfiguration,
            cookies = '',
            cookiesJson = ''
        } = input;

        const RESULTS_WANTED = Number.isFinite(+RESULTS_WANTED_RAW) ? Math.max(1, +RESULTS_WANTED_RAW) : Number.MAX_SAFE_INTEGER;
        const MAX_PAGES = Number.isFinite(+MAX_PAGES_RAW) ? Math.max(1, +MAX_PAGES_RAW) : 999;

        const toAbs = (href, base = 'https://www.goodreads.com') => {
            try { return new URL(href, base).href; } catch { return null; }
        };

        const cleanText = (text) => {
            if (!text) return '';
            return String(text).replace(/\s+/g, ' ').trim();
        };

        const buildStartUrl = (shelfName) => {
            return `https://www.goodreads.com/shelf/show/${encodeURIComponent(shelfName)}`;
        };

        const initial = [];
        if (Array.isArray(startUrls) && startUrls.length) initial.push(...startUrls);
        if (startUrl) initial.push(startUrl);
        if (url) initial.push(url);
        if (!initial.length) initial.push(buildStartUrl(shelf));

        const proxyConf = proxyConfiguration ? await Actor.createProxyConfiguration({ ...proxyConfiguration }) : undefined;

        // Parse cookies if provided
        let cookieHeader = cookies;
        if (cookiesJson) {
            try {
                const parsed = JSON.parse(cookiesJson);
                if (Array.isArray(parsed)) {
                    cookieHeader = parsed.map(c => `${c.name}=${c.value}`).join('; ');
                } else if (typeof parsed === 'object') {
                    cookieHeader = Object.entries(parsed).map(([k, v]) => `${k}=${v}`).join('; ');
                }
            } catch (e) {
                log.warning(`Failed to parse cookiesJson: ${e.message}`);
            }
        }

        let saved = 0;
        const seenUrls = new Set();

        // ===== STEALTH: User-Agent Rotation Pool =====
        const USER_AGENTS = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
        ];
        const getRandomUA = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        const randomDelay = (min = 100, max = 300) => new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

        function extractFromJsonLd($) {
            const scripts = $('script[type="application/ld+json"]');
            for (let i = 0; i < scripts.length; i++) {
                try {
                    const parsed = JSON.parse($(scripts[i]).html() || '');
                    const arr = Array.isArray(parsed) ? parsed : [parsed];
                    for (const e of arr) {
                        if (!e) continue;
                        const t = e['@type'] || e.type;
                        if (t === 'Book' || (Array.isArray(t) && t.includes('Book'))) {
                            return {
                                title: e.name || e.title || null,
                                author: e.author?.name || (Array.isArray(e.author) ? e.author.map(a => a.name).join(', ') : null),
                                rating: e.aggregateRating?.ratingValue || null,
                                ratingCount: e.aggregateRating?.ratingCount || null,
                                reviewCount: e.aggregateRating?.reviewCount || null,
                                isbn: e.isbn || null,
                                publisher: e.publisher?.name || null,
                                publishDate: e.datePublished || null,
                                description: e.description || null,
                                image: e.image || null,
                                genres: Array.isArray(e.genre) ? e.genre : (e.genre ? [e.genre] : []),
                            };
                        }
                    }
                } catch (e) { /* ignore parsing errors */ }
            }
            return null;
        }

        function extractBooksFromList($, base) {
            const books = [];

            // Try to extract from book items - Goodreads uses .bookTitle class and .leftAlignedImage for book containers
            $('.leftAlignedImage, .elementList').each((_, elem) => {
                try {
                    const $elem = $(elem);

                    // Extract book URL
                    const bookLink = $elem.find('a.bookTitle').first();
                    const bookUrl = bookLink.attr('href');
                    if (!bookUrl) return;
                    const fullUrl = toAbs(bookUrl, base);
                    if (!fullUrl || seenUrls.has(fullUrl)) return;
                    seenUrls.add(fullUrl);

                    // Extract title
                    const title = cleanText(bookLink.text()) || cleanText(bookLink.attr('title')) || null;

                    // Extract author
                    const authorLink = $elem.find('a.authorName').first();
                    const author = cleanText(authorLink.text()) || null;

                    // Extract rating
                    const ratingText = $elem.find('.minirating').first().text();
                    const ratingMatch = ratingText.match(/(\d+\.\d+)/);
                    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;

                    // Extract rating count
                    const ratingCountMatch = ratingText.match(/avg rating.*?([\d,]+)\s+rating/i);
                    const ratingCount = ratingCountMatch ? parseInt(ratingCountMatch[1].replace(/,/g, '')) : null;

                    // Extract review count
                    const reviewCountMatch = ratingText.match(/([\d,]+)\s+review/i);
                    const reviewCount = reviewCountMatch ? parseInt(reviewCountMatch[1].replace(/,/g, '')) : null;

                    // Extract image
                    const imgElem = $elem.find('img').first();
                    const image = imgElem.attr('src') || imgElem.attr('data-src') || null;

                    books.push({
                        url: fullUrl,
                        title,
                        author,
                        rating,
                        ratingCount,
                        reviewCount,
                        image,
                    });
                } catch (err) {
                    log.debug(`Error extracting book: ${err.message}`);
                }
            });

            return books;
        }

        function findNextPage($, base, currentPage) {
            // Try CSS selector first
            const nextLink = $('a.next_page').first();
            if (nextLink.length && !nextLink.hasClass('disabled')) {
                const href = nextLink.attr('href');
                if (href) return toAbs(href, base);
            }

            // Try building next page URL manually
            const nextPageNum = currentPage + 1;
            const currentUrl = new URL(base);
            currentUrl.searchParams.set('page', nextPageNum);
            return currentUrl.href;
        }

        const crawler = new CheerioCrawler({
            proxyConfiguration: proxyConf,

            // ===== PERFORMANCE: 3x Speed Increase =====
            maxConcurrency: 15,                    // Increased from 5 (safe for HTTP-only CheerioCrawler)
            minConcurrency: 3,                     // Maintain minimum parallelism  
            maxRequestsPerMinute: 150,             // Rate limiting for stealth
            requestHandlerTimeoutSecs: 45,         // Faster timeout for quick failure recovery
            navigationTimeoutSecs: 30,             // Faster navigation timeout

            // ===== SESSION POOL: Anti-Blocking =====
            useSessionPool: true,
            sessionPoolOptions: {
                maxPoolSize: 50,                   // Large pool for rotation
                sessionOptions: {
                    maxUsageCount: 20,             // Rotate sessions after 20 uses
                    maxErrorScore: 2,              // Quick retire on errors
                },
                blockedStatusCodes: [401, 403, 429, 503], // Auto-retire blocked sessions
            },
            maxRequestRetries: 4,                  // More retries with exponential backoff

            // ===== STEALTH: Browser Fingerprint Headers =====
            preNavigationHooks: [
                async (crawlingContext) => {
                    // Random delay for human-like request timing
                    await randomDelay(80, 200);

                    // Rotate User-Agent per request
                    const ua = getRandomUA();

                    // Full browser fingerprint headers
                    crawlingContext.request.headers = {
                        ...crawlingContext.request.headers,
                        'User-Agent': ua,
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                        'Sec-Ch-Ua-Mobile': '?0',
                        'Sec-Ch-Ua-Platform': '"Windows"',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'same-origin',
                        'Sec-Fetch-User': '?1',
                        'Upgrade-Insecure-Requests': '1',
                        'Referer': 'https://www.goodreads.com/',
                    };

                    // Add cookies if provided
                    if (cookieHeader) {
                        crawlingContext.request.headers.Cookie = cookieHeader;
                    }
                }
            ],

            // ===== ADDITIONAL STEALTH OPTIONS =====
            additionalMimeTypes: ['application/json', 'text/plain'],
            ignoreSslErrors: true,

            async requestHandler({ request, $, enqueueLinks, log: crawlerLog }) {
                const label = request.userData?.label || 'LIST';
                const pageNo = request.userData?.pageNo || 1;

                if (label === 'LIST') {
                    crawlerLog.info(`📖 Shelf page ${pageNo}: ${request.url}`);

                    const books = extractBooksFromList($, request.url);
                    crawlerLog.info(`Found ${books.length} books on page ${pageNo}`);

                    if (books.length === 0) {
                        crawlerLog.warning(`No books found on page ${pageNo}. This might be due to: 1) Login required for pagination, 2) Last page reached, or 3) Changed selectors`);
                    }

                    if (collectDetails && books.length > 0) {
                        const remaining = RESULTS_WANTED - saved;
                        const toEnqueue = books.slice(0, Math.max(0, remaining));
                        if (toEnqueue.length) {
                            await enqueueLinks({
                                urls: toEnqueue.map(b => b.url),
                                userData: { label: 'DETAIL', basicInfo: toEnqueue }
                            });
                        }
                    } else if (books.length > 0) {
                        const remaining = RESULTS_WANTED - saved;
                        const toPush = books.slice(0, Math.max(0, remaining));
                        if (toPush.length) {
                            await Dataset.pushData(toPush.map(b => ({ ...b, _source: 'goodreads' })));
                            saved += toPush.length;
                            crawlerLog.info(`Saved ${toPush.length} books (total: ${saved})`);
                        }
                    }

                    // Handle pagination
                    if (saved < RESULTS_WANTED && pageNo < MAX_PAGES && books.length > 0) {
                        const next = findNextPage($, request.url, pageNo);
                        if (next) {
                            crawlerLog.info(`Enqueuing next page: ${next}`);
                            await enqueueLinks({ urls: [next], userData: { label: 'LIST', pageNo: pageNo + 1 } });
                        } else {
                            crawlerLog.info(`No next page found. Reached end of pagination.`);
                        }
                    } else if (saved >= RESULTS_WANTED) {
                        crawlerLog.info(`Reached target of ${RESULTS_WANTED} books. Stopping pagination.`);
                    } else if (pageNo >= MAX_PAGES) {
                        crawlerLog.info(`Reached maximum pages limit (${MAX_PAGES}). Stopping pagination.`);
                    }
                    return;
                }

                if (label === 'DETAIL') {
                    if (saved >= RESULTS_WANTED) return;
                    try {
                        crawlerLog.info(`Scraping book details: ${request.url}`);

                        // Try JSON-LD first
                        const jsonData = extractFromJsonLd($);
                        const data = jsonData || {};

                        // Fallback to HTML parsing
                        if (!data.title) {
                            data.title = cleanText($('h1[data-testid="bookTitle"], h1.gr-h1, #bookTitle').first().text()) || null;
                        }

                        if (!data.author) {
                            const authorElem = $('span[data-testid="name"], .authorName__container a, a.authorName').first();
                            data.author = cleanText(authorElem.text()) || null;
                        }

                        if (!data.rating) {
                            const ratingElem = $('[class*="RatingStatistics"] [class*="average"], .RatingStatistics__rating, [itemprop="ratingValue"]').first();
                            const ratingText = cleanText(ratingElem.text());
                            const ratingMatch = ratingText.match(/(\d+\.\d+)/);
                            data.rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
                        }

                        if (!data.ratingCount) {
                            const ratingCountElem = $('[data-testid="ratingsCount"], [itemprop="ratingCount"]').first();
                            const ratingCountText = cleanText(ratingCountElem.text());
                            const countMatch = ratingCountText.match(/([\d,]+)/);
                            data.ratingCount = countMatch ? parseInt(countMatch[1].replace(/,/g, '')) : null;
                        }

                        if (!data.reviewCount) {
                            const reviewCountElem = $('[data-testid="reviewsCount"], [itemprop="reviewCount"]').first();
                            const reviewCountText = cleanText(reviewCountElem.text());
                            const countMatch = reviewCountText.match(/([\d,]+)/);
                            data.reviewCount = countMatch ? parseInt(countMatch[1].replace(/,/g, '')) : null;
                        }

                        if (!data.description) {
                            const descElem = $('[data-testid="description"], .BookPageMetadataSection__description [role="heading"] + div, #description span').last();
                            data.description = cleanText(descElem.text()) || null;
                        }

                        if (!data.image) {
                            const imgElem = $('[class*="BookCover"] img, .BookPage__bookCover img, #coverImage').first();
                            data.image = imgElem.attr('src') || imgElem.attr('data-src') || null;
                        }

                        // Extract additional details
                        if (!data.publisher) {
                            const publisherElem = $('[data-testid="publicationInfo"]').first();
                            const publisherText = cleanText(publisherElem.text());
                            const publisherMatch = publisherText.match(/by\s+([^,]+)/i);
                            data.publisher = publisherMatch ? publisherMatch[1].trim() : null;
                        }

                        if (!data.publishDate) {
                            const publishDateElem = $('[data-testid="publicationInfo"]').first();
                            const publishDateText = cleanText(publishDateElem.text());
                            const dateMatch = publishDateText.match(/(\w+\s+\d+,?\s+\d{4})/);
                            data.publishDate = dateMatch ? dateMatch[1] : null;
                        }

                        if (!data.isbn) {
                            const isbnText = $('.infoBoxRowItem').filter((_, el) => /isbn/i.test($(el).prev().text())).first().text();
                            data.isbn = cleanText(isbnText) || null;
                        }

                        if (!data.genres || data.genres.length === 0) {
                            const genres = [];
                            $('[data-testid="genresList"] a, .bookPageGenreLink, .actionLinkLite.bookPageGenreLink').each((_, el) => {
                                const genre = cleanText($(el).text());
                                if (genre) genres.push(genre);
                            });
                            data.genres = genres.length > 0 ? genres : null;
                        }

                        const item = {
                            title: data.title || null,
                            author: data.author || null,
                            rating: data.rating || null,
                            ratingCount: data.ratingCount || null,
                            reviewCount: data.reviewCount || null,
                            description: data.description || null,
                            image: data.image || null,
                            isbn: data.isbn || null,
                            publisher: data.publisher || null,
                            publishDate: data.publishDate || null,
                            genres: data.genres || null,
                            url: request.url,
                            _source: 'goodreads'
                        };

                        await Dataset.pushData(item);
                        saved++;
                        crawlerLog.info(`Saved book: "${item.title}" (${saved}/${RESULTS_WANTED})`);
                    } catch (err) {
                        crawlerLog.error(`DETAIL ${request.url} failed: ${err.message}`);
                    }
                }
            }
        });

        await crawler.run(initial.map(u => ({ url: u, userData: { label: 'LIST', pageNo: 1 } })));
        log.info(`Finished. Saved ${saved} books`);
    } finally {
        await Actor.exit();
    }
}

main().catch(err => { console.error(err); process.exit(1); });
