# Hotel Crawl Manager - Electron Desktop App

Ứng dụng desktop được xây dựng với React + Vite + Electron.

## Cài đặt Dependencies

```bash
npm install
```

## Chạy Ứng Dụng

### Development Mode (Khuyến nghị)

Chạy ứng dụng trong chế độ development với hot-reload:

```bash
npm start
```

Lệnh này sẽ:
1. Khởi động Vite dev server trên http://localhost:3000
2. Chờ server sẵn sàng
3. Mở ứng dụng Electron với DevTools

### Production Mode

Chỉ chạy Electron (cần build trước):

```bash
npm run electron
```

## Build Ứng Dụng

### Build cho tất cả platforms

```bash
npm run electron:build
```

### Build cho từng platform cụ thể

```bash
# Windows
npm run electron:build:win

# macOS
npm run electron:build:mac

# Linux
npm run electron:build:linux
```

File build sẽ được lưu trong thư mục `release/`.

## Cấu Trúc Project

```
.
├── electron.cjs          # Main process của Electron
├── preload.cjs           # Preload script (bridge giữa main và renderer)
├── src/
│   ├── App.tsx           # React app chính
│   ├── index.tsx         # Entry point
│   └── ...
├── dist/                 # Build output của Vite
├── release/              # Build output của Electron
└── package.json
```

## Scripts Có Sẵn

- `npm start` - Chạy app trong development mode
- `npm run dev` - Chỉ chạy Vite dev server
- `npm run build` - Build web app với Vite
- `npm run electron` - Chạy Electron app
- `npm run electron:build` - Build desktop app cho tất cả platforms
- `npm run electron:build:win` - Build cho Windows
- `npm run electron:build:mac` - Build cho macOS
- `npm run electron:build:linux` - Build cho Linux

## Tính Năng

- ✅ Hot-reload trong development mode
- ✅ DevTools tự động mở trong development
- ✅ Context isolation và preload script cho bảo mật
- ✅ Hỗ trợ build cho Windows, macOS, Linux
- ✅ Cấu hình tối ưu cho Electron

## Lưu Ý

- Ứng dụng yêu cầu Node.js và npm
- Trong development mode, app sẽ tải từ http://localhost:3000
- Trong production mode, app sẽ tải từ file `dist/index.html`
- Cần có icon.png trong thư mục gốc để build installer

## Troubleshooting

### Lỗi "Application has not been started"
- Đảm bảo Vite dev server đã khởi động hoàn toàn
- Kiểm tra port 3000 có đang được sử dụng bởi app khác

### Build bị lỗi
- Chạy `npm run build` trước để kiểm tra Vite build
- Kiểm tra có file icon.png trong project
