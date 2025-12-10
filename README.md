# Goodreads Book Scraper

Extract comprehensive book data from Goodreads shelves including titles, authors, ratings, reviews, descriptions, ISBNs, genres, and publication details. Perfect for book analysis, market research, reading list creation, and literary data collection.

## What does the Goodreads Book Scraper do?

The Goodreads Book Scraper enables you to extract detailed book information from any Goodreads shelf or category. Whether you're building a reading recommendation system, conducting market research, or creating a personal book database, this scraper provides all the data you need.

### Key capabilities:

- **📚 Extract book details** - Titles, authors, ratings, review counts, descriptions, and more
- **🔄 Automatic pagination** - Seamlessly navigate through multiple pages of results
- **⚡ Fast & efficient** - Lightweight design optimized for speed and reliability
- **📊 Structured data** - Clean JSON output ready for analysis or integration
- **🎯 Flexible targeting** - Scrape any Goodreads shelf by name or URL
- **🔍 Two scraping modes** - Quick overview or detailed book information

## Why scrape Goodreads?

Goodreads is the world's largest community of book lovers with over 90 million members and data on millions of books. Access to this data enables:

- **Market research** - Analyze book trends, popular genres, and reader preferences
- **Recommendation systems** - Build personalized book recommendation engines
- **Content curation** - Create reading lists and book collections
- **Price monitoring** - Track book popularity for inventory decisions
- **Academic research** - Study reading patterns and literary trends
- **Personal libraries** - Organize and manage your reading lists

## How much does it cost to scrape Goodreads?

The cost depends on the number of books you scrape and whether you enable detailed scraping. Here are typical usage estimates:

- **100 books (basic)** - ~0.01-0.02 Apify compute units
- **100 books (detailed)** - ~0.03-0.05 Apify compute units
- **1,000 books (detailed)** - ~0.30-0.50 Apify compute units

Apify provides 5 USD of free credits monthly, enough to scrape thousands of books. For larger projects, paid plans start at $49/month.

## Input configuration

Configure the scraper using these parameters:

### Basic settings

<table>
<tr><td><b>Start URL</b></td><td>Direct URL to a Goodreads shelf (e.g., <code>https://www.goodreads.com/shelf/show/fantasy</code>)</td></tr>
<tr><td><b>Shelf Name</b></td><td>Name of the shelf to scrape (e.g., <code>fantasy</code>, <code>science-fiction</code>, <code>bestsellers</code>)</td></tr>
<tr><td><b>Maximum Books</b></td><td>Number of books to scrape (default: 100)</td></tr>
<tr><td><b>Maximum Pages</b></td><td>Safety limit on pages to visit (default: 10)</td></tr>
</table>

### Advanced settings

<table>
<tr><td><b>Collect Details</b></td><td>Enable to extract full book information including descriptions, ISBNs, and genres (default: enabled)</td></tr>
<tr><td><b>Cookies</b></td><td>Authentication cookies for accessing paginated results (required for pages beyond the first)</td></tr>
<tr><td><b>Proxy Configuration</b></td><td>Proxy settings (residential proxies recommended)</td></tr>
</table>

### Example input

```json
{
  "shelf": "fantasy",
  "results_wanted": 100,
  "max_pages": 5,
  "collectDetails": true,
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

## Output format

The scraper provides structured JSON data for each book:

### Basic output (without detailed scraping)

```json
{
  "title": "The Name of the Wind",
  "author": "Patrick Rothfuss",
  "rating": 4.52,
  "ratingCount": 985432,
  "reviewCount": 45678,
  "image": "https://i.gr-assets.com/images/S/...",
  "url": "https://www.goodreads.com/book/show/186074"
}
```

### Detailed output (with detailed scraping enabled)

```json
{
  "title": "The Name of the Wind",
  "author": "Patrick Rothfuss",
  "rating": 4.52,
  "ratingCount": 985432,
  "reviewCount": 45678,
  "description": "Told in Kvothe's own voice, this is the tale of the magically gifted young man...",
  "image": "https://i.gr-assets.com/images/S/...",
  "isbn": "0756404746",
  "publisher": "DAW Books",
  "publishDate": "March 27, 2007",
  "genres": ["Fantasy", "Fiction", "Magic", "Adventure"],
  "url": "https://www.goodreads.com/book/show/186074"
}
```

### Output fields

<table>
<tr><th>Field</th><th>Type</th><th>Description</th></tr>
<tr><td>title</td><td>string</td><td>Book title</td></tr>
<tr><td>author</td><td>string</td><td>Primary author name(s)</td></tr>
<tr><td>rating</td><td>number</td><td>Average rating (0-5 scale)</td></tr>
<tr><td>ratingCount</td><td>number</td><td>Total number of ratings</td></tr>
<tr><td>reviewCount</td><td>number</td><td>Total number of reviews</td></tr>
<tr><td>description</td><td>string</td><td>Book description/synopsis (detailed mode only)</td></tr>
<tr><td>image</td><td>string</td><td>URL to book cover image</td></tr>
<tr><td>isbn</td><td>string</td><td>ISBN identifier (detailed mode only)</td></tr>
<tr><td>publisher</td><td>string</td><td>Publisher name (detailed mode only)</td></tr>
<tr><td>publishDate</td><td>string</td><td>Publication date (detailed mode only)</td></tr>
<tr><td>genres</td><td>array</td><td>List of book genres/categories (detailed mode only)</td></tr>
<tr><td>url</td><td>string</td><td>Goodreads book URL</td></tr>
</table>

## How to use the Goodreads Book Scraper

### Using the Apify Console

1. Navigate to the [Goodreads Book Scraper](https://apify.com/your-username/goodreads-book-scraper) on Apify
2. Click **Try for free**
3. Enter your configuration:
   - **Shelf name** (e.g., "fantasy", "bestsellers")
   - **Number of books** you want to scrape
   - Toggle **Collect Details** for comprehensive data
4. Click **Start** to begin scraping
5. Download results in JSON, CSV, Excel, or HTML format

### Using the Apify API

```javascript
const Apify = require('apify-client');
const client = new Apify.ApifyClient({
    token: 'YOUR_API_TOKEN',
});

const run = await client.actor('YOUR_USERNAME/goodreads-book-scraper').call({
    shelf: 'fantasy',
    results_wanted: 100,
    collectDetails: true,
});

const { items } = await client.dataset(run.defaultDatasetId).listItems();
console.log(items);
```

### Using as a standalone script

1. Clone this repository
2. Run `npm install`
3. Configure `INPUT.json` with your parameters
4. Run `npm start`

## Important notes on pagination

**⚠️ Authentication requirement:** Goodreads restricts pagination to authenticated users. Non-logged users can only access the first page (approximately 50 books).

### To access multiple pages:

1. **Log in to Goodreads** in your browser
2. **Open DevTools** (F12) → Network tab
3. **Reload the page** and find a request to goodreads.com
4. **Copy the Cookie header** from the request headers
5. **Paste the cookie value** into the "Authentication cookies" field

The scraper will use your cookies to access paginated results. Pagination URLs follow this pattern:
```
https://www.goodreads.com/shelf/show/fantasy?page=2
```

## Popular Goodreads shelves to scrape

Get started quickly with these popular shelves:

- `fantasy` - Fantasy fiction and magic
- `science-fiction` - Sci-fi and speculative fiction
- `romance` - Romance novels
- `mystery` - Mystery and thriller books
- `young-adult` - YA fiction
- `classics` - Classic literature
- `non-fiction` - Non-fiction works
- `biography` - Biographies and memoirs
- `history` - Historical works
- `self-help` - Self-improvement books
- `business` - Business books
- `philosophy` - Philosophy texts

You can find more shelves by browsing [Goodreads Shelves](https://www.goodreads.com/shelf).

## Scraping best practices

### Performance optimization

- **Set reasonable limits** - Use `results_wanted` to control scraping volume
- **Enable detailed scraping selectively** - Disable if you only need basic information
- **Use residential proxies** - Required for accessing multiple pages
- **Implement rate limiting** - The scraper includes built-in concurrency controls

### Data quality

- **Validate output** - Check that all expected fields are populated
- **Handle missing data** - Some books may have incomplete information
- **Monitor for changes** - Goodreads may update their HTML structure

### Compliance

- **Respect robots.txt** - The scraper follows Goodreads guidelines
- **Don't overload servers** - Use appropriate concurrency settings
- **Review Terms of Service** - Ensure your use case complies with Goodreads policies
- **Personal use recommended** - Commercial use may require additional consideration

## Troubleshooting

### No books found on page 2+

**Solution:** You need to provide authentication cookies. See the pagination section above.

### Scraper returns incomplete data

**Solution:** Enable "Collect Details" to fetch comprehensive book information.

### Rate limiting or blocked requests

**Solution:** Use residential proxies and reduce concurrency if needed.

### Outdated selectors

**Solution:** Goodreads occasionally updates their website. Contact support if selectors need updating.

## Use cases

### Market Research
Analyze book trends, identify popular genres, and understand reader preferences to make data-driven publishing decisions.

### Recommendation Systems
Build sophisticated book recommendation engines using ratings, genres, and reader reviews.

### Academic Research
Study literary trends, analyze reading patterns, and conduct research on book popularity and cultural impact.

### Content Creation
Create curated reading lists, book blogs, and literary content based on comprehensive book data.

### Personal Library Management
Organize your reading lists, track books to read, and manage your personal book collection.

## Support

Need help? Have questions?

- **Documentation:** Check out the detailed [Apify documentation](https://docs.apify.com)
- **Community:** Join the [Apify Discord](https://discord.com/invite/jyEM2PRvMU)
- **Issues:** Report bugs or request features on the [GitHub repository](#)

## Related actors

Explore similar scrapers:

- **Amazon Book Scraper** - Extract book data from Amazon
- **Barnes & Noble Scraper** - Scrape B&N book listings
- **Google Books Scraper** - Extract data from Google Books
- **Book Price Monitor** - Track book prices across platforms

---

Built with ❤️ for the reading community. Happy scraping!
