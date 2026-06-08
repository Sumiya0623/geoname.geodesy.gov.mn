# Цэг тэмдэгтийн систем Frontend

> Цэг тэмдэгтийн сан

## Шаардлага

- **Node.js**: 16.x or 18.x
- **Package Manager**: npm

## Quick Start

### Using NPM

```bash
npm install
# сангийн асуудал гарвал
npm install --legacy-peer-deps

npm run dev
```

## Scripts

| Script | Тайлбар |
|--------|-------------|
| `dev` | Хөгжүүлэлтийн орчинд port 3009 дээр асаар |
| `start` | Production орчинд port 3022 дээр асаах |
| `build` | Production орчинд зориулсан build хийх (Кодонд өөрчлөлт оруулсан бол заавал хийх ёстой) |
| `re:start` | Clean install and start development |
| `re:build` | Clean install and build |

## Tech Stack

- **Framework**: Next.js 14.x
- **Language**: JavaScript
- **UI Library**: Material-UI (MUI) 5.x
- **Maps**: OpenLayers
- **State Management**: SWR
- **Forms**: React Hook Form with Yup validation
- **Charts**: ApexCharts, MUI X Charts
- **File Processing**: PDF-lib, XLSX, GeoPackage

## Хөгжүүлэлт

### Орчны тохиргоо

1. Repository-г хуулах
2. Сан суулгах:
   ```bash
   npm install
   ```
3. Хөгжүүлэлтийн сервер асаах:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3009](http://localhost:3009)

## Бүтэц

```
src/
├── api/         # API холболт
├── app/         # Next.js app directory
├── assets/      # Static файлууд
├── auth/        # Нэвтрэх тохиргоо
├── components/  # Дахин ашиглагдах хэсгүүд
├── hooks/       # React hooks
├── layouts/     # Хуудасны layouts
├── locales/     # Internationalization
├── routes/      # Замын тохиргоонууд
├── sections/    # Хуудсын хэсгүүд
├── theme/       # MUI theme тохиргоо
└── utils/       # Utility functions
```

## Deployment

Deploy хийх үеийн тохиргоонууд:
- Bundle analysis support
- SVG optimization
- Material-UI modular imports
- Trailing slash support

## Browser Support

ES2020+ features дэмждэг орчин үеийн интернет хөтчүүд.

## Орчны Хувьсагчид

NEXT_PUBLIC_HOST_API=https://point.geodesy.gov.mn/api
NEXT_PUBLIC_GEOSERVER_URL=https://point.geodesy.gov.mn/geoserver
NEXT_PUBLIC_ASSETS_DIR='/assets'
NEXT_PUBLIC_PORTAL_URL=https://geodesy.gov.mn
NEXT_MAIN_API=https://geodesy.gov.mn/api
