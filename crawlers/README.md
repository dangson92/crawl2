# Booking.com Hotel Crawler

Module crawl thông tin khách sạn từ Booking.com sử dụng Node.js và Puppeteer.

## Tính năng

Module này có thể crawl các thông tin sau từ trang Booking.com:

- ✅ **Tên khách sạn** - Hotel name
- ✅ **Địa chỉ** - Address
- ✅ **Đánh giá** - Rating (score, review count, category)
- ✅ **Tiện nghi** - Facilities
- ✅ **FAQs** - Frequently Asked Questions
- ✅ **Mô tả** - About/Description
- ✅ **Hình ảnh** - Images (from gallery popup)

## Cài đặt

```bash
# Dependencies đã được cài trong project
npm install
```

## Tìm đường dẫn Chrome

Trước khi chạy crawler, bạn cần tìm đường dẫn đến Chrome trên máy:

```bash
node crawlers/findChrome.js
```

## Cách sử dụng

### 1. Sử dụng file example

Chạy file example đã được cấu hình sẵn:

```bash
node crawlers/example.js
```

### 2. Sử dụng trong code của bạn

```javascript
import BookingCrawler from './crawlers/bookingCrawler.js';

async function crawlHotel() {
  // Khởi tạo crawler
  const crawler = new BookingCrawler({
    headless: false,           // false = hiện browser, true = chạy ngầm
    timeout: 60000,            // Timeout 60 giây
    executablePath: '/usr/bin/google-chrome', // Đường dẫn Chrome local
  });

  try {
    // Crawl hotel
    const hotelUrl = 'https://www.booking.com/hotel/vn/mekong-lodge.html';
    const data = await crawler.crawlHotel(hotelUrl);

    console.log('Hotel Name:', data.name);
    console.log('Address:', data.address);
    console.log('Rating:', data.rating);
    console.log('Facilities:', data.facilities);
    console.log('FAQs:', data.faqs);
    console.log('About:', data.about);
    console.log('Images:', data.images.length);

  } finally {
    // Đóng browser
    await crawler.close();
  }
}

crawlHotel();
```

## Cấu hình

### BookingCrawler Options

```javascript
const crawler = new BookingCrawler({
  headless: false,              // Chạy browser ẩn (true) hoặc hiện (false)
  timeout: 30000,               // Timeout cho mỗi thao tác (ms)
  executablePath: null,         // Đường dẫn đến Chrome executable
  userDataDir: null,            // Đường dẫn đến Chrome profile (optional)
});
```

### Đường dẫn Chrome mặc định

**Windows:**
```
C:\Program Files\Google\Chrome\Application\chrome.exe
C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
```

**macOS:**
```
/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

**Linux:**
```
/usr/bin/google-chrome
/usr/bin/chromium-browser
/usr/bin/chromium
```

## API Reference

### `new BookingCrawler(options)`

Tạo instance crawler mới.

**Options:**
- `headless` (boolean): Chạy browser ẩn, mặc định `true`
- `timeout` (number): Timeout cho operations, mặc định `30000`ms
- `executablePath` (string): Đường dẫn Chrome executable
- `userDataDir` (string): Chrome user data directory

### `await crawler.init()`

Khởi tạo browser và page. Được gọi tự động trong `crawlHotel()`.

### `await crawler.crawlHotel(url)`

Crawl tất cả thông tin của khách sạn.

**Parameters:**
- `url` (string): URL của trang khách sạn trên Booking.com

**Returns:**
```javascript
{
  url: 'https://www.booking.com/hotel/...',
  name: 'Hotel Name',
  address: 'Hotel Address',
  rating: {
    score: 9.2,
    reviewCount: 1234,
    category: 'Excellent'
  },
  facilities: ['Free WiFi', 'Pool', 'Restaurant', ...],
  faqs: [
    { question: '...', answer: '...' },
    ...
  ],
  about: 'Hotel description...',
  images: ['url1', 'url2', ...],
  crawledAt: '2024-12-02T...'
}
```

### `await crawler.close()`

Đóng browser.

## Các phương thức riêng lẻ

Bạn cũng có thể gọi từng phương thức để lấy thông tin cụ thể:

```javascript
await crawler.init();
await crawler.page.goto(url);

const name = await crawler.getHotelName();
const address = await crawler.getAddress();
const rating = await crawler.getRating();
const facilities = await crawler.getFacilities();
const faqs = await crawler.getFAQs();
const about = await crawler.getAbout();
const images = await crawler.getImages(url);

await crawler.close();
```

## Output

Kết quả crawl sẽ được lưu vào thư mục `output/` với format:

```
output/hotel-data-YYYY-MM-DDTHH-MM-SS-mmmZ.json
```

## Lưu ý

1. **Rate Limiting**: Booking.com có thể chặn nếu crawl quá nhiều. Nên thêm delay giữa các request.

2. **Bot Detection**: Module đã set user agent và các cấu hình để tránh bị phát hiện là bot, nhưng vẫn có thể bị chặn.

3. **Selectors**: Booking.com có thể thay đổi cấu trúc HTML. Nếu không lấy được dữ liệu, cần cập nhật selectors trong code.

4. **Images**: Module sẽ tự động mở gallery popup để lấy đầy đủ hình ảnh bằng cách thêm parameter `?activeTab=photosGallery`.

5. **Chrome Local**: Sử dụng Chrome local giúp tiết kiệm bandwidth và có profile/cookies sẵn có.

## Troubleshooting

### Lỗi "Chrome not found"

Cài đặt Google Chrome hoặc Chromium:

**Ubuntu/Debian:**
```bash
sudo apt-get install google-chrome-stable
# hoặc
sudo apt-get install chromium-browser
```

**macOS:**
```bash
brew install --cask google-chrome
```

**Windows:**
Download và cài từ: https://www.google.com/chrome/

### Lỗi "Timeout"

Tăng timeout trong options:

```javascript
const crawler = new BookingCrawler({
  timeout: 120000, // 120 giây
});
```

### Không lấy được dữ liệu

1. Chạy với `headless: false` để xem browser
2. Check console logs
3. Booking.com có thể đã thay đổi HTML structure

## License

MIT
