# Orthodox Econet — Build Progress Checkpoint
# Paste this at the start of the next session to continue.
# Last updated: Phase 1 + Phase 2 + Phase 3 complete — entire backend done.

## Project
- **App**: የኦርቶዶክስ ኢኮኖሚ ኔትወርክ (Orthodox Econet) — Telegram Mini App
- **Deployment**: Single Render free-tier web service (Express serves React build)
- **DB**: Neon PostgreSQL via Prisma 5
- **File storage**: Cloudinary (stream from memory, no disk writes)
- **Stack**: Node 20, Express 4, Socket.io 4, React 18, Tailwind, Zustand, TanStack Query, react-i18next, Prisma 5

## Key Decisions (locked — do not revisit)
- Single Render web service only
- Mastermind groups: deferred to v2 (commented in schema)
- Saved searches: deferred to v2
- My Feed: chronological only (no ML ranking)
- Sentiment analysis: schema fields exist, no active analysis
- Marketplace offers: simplified (no bot relay chat)
- Voice-to-text: excluded
- Users per section in admin overview: removed
- Faith declaration: `creedAccepted Boolean` + backend phrase validation in POST /api/auth/register
- Donations: Telebirr + Bank + Cash, admin manual confirmation
- Settings table: owner-editable key-value for payment info, support username, banned words
- UptimeRobot pings /health every 14 min to prevent Render cold start
- GENERATE_SOURCEMAP=false in React build to stay within Render 512MB RAM

## Creed phrase (backend validation in auth.js)
```
በሥላሴ ሦስትነት እና አንድነት አምናለው፣ የኢየሱስ ክርስቶስን የባህርይ አምላክነት በፍጹም ልቤ አምናለው፣ የድንግል ማርያም ጻድቃን መላዕክት ሰማዕታት አማላጅነት አምናለው።
```

---

## ✅ Phase 1 — COMPLETE (Foundation)
| File | Status |
|------|--------|
| `package.json` (root) | ✅ |
| `backend/package.json` | ✅ |
| `frontend/package.json` | ✅ |
| `prisma/schema.prisma` | ✅ — 24 models, all enums |
| `.env.example` | ✅ |
| `backend/src/server.js` | ✅ |
| `backend/src/config/db.js` | ✅ |
| `backend/src/config/cloudinary.js` | ✅ |
| `backend/src/config/telegram.js` | ✅ |
| `backend/src/middleware/auth.js` | ✅ |
| `backend/src/middleware/rbac.js` | ✅ |
| `backend/src/middleware/automod.js` | ✅ |
| `backend/src/middleware/rateLimit.js` | ✅ |
| `backend/src/middleware/upload.js` | ✅ |
| `backend/src/services/botService.js` | ✅ |
| `backend/src/services/socketService.js` | ✅ |
| `backend/src/utils/helpers.js` | ✅ |

## ✅ Phase 2 — COMPLETE (Core routes)
| File | Status |
|------|--------|
| `backend/src/routes/auth.js` | ✅ — initData, register+creed, 2FA, recovery |
| `backend/src/routes/users.js` | ✅ — profile, stats, endorsements |
| `backend/src/routes/posts.js` | ✅ — cursor pagination, automod, reactions, replies, reports |
| `backend/src/routes/admin.js` | ✅ — verifications, posts, users, ban/warn, audit log, overview, reports, badges, professional apps, donations, CSV export |
| `backend/src/routes/broadcast.js` | ✅ — general + section announcements, pin/unpin, bot push |
| `backend/src/routes/notifications.js` | ✅ — list, mark read, unread count |

## ✅ Phase 3 — COMPLETE (Feature routes)
| File | Status |
|------|--------|
| `backend/src/routes/donations.js` | ✅ — submit, payment-info, user's own list |
| `backend/src/routes/settings.js` | ✅ — Owner-only key-value config |
| `backend/src/routes/marketplace.js` | ✅ — listings CRUD, offers, search/filter |
| `backend/src/routes/mentorship.js` | ✅ — mentor directory, register, request, match management |
| `backend/src/routes/polls.js` | ✅ — create, vote (single/multi), cancel |
| `backend/src/routes/liveqa.js` | ✅ — AMA sessions, questions, upvotes, answers |
| `backend/src/routes/bookings.js` | ✅ — request, list, status update |
| `backend/src/routes/professional.js` | ✅ — apply, directory, own profile |

**BACKEND IS COMPLETE. 26 JS files, 0 syntax errors.**

---

## 🔲 Phase 4 — Next session: Frontend foundation

### Start command for next session:
"Continue Orthodox Econet build — Phase 4: Frontend foundation. The backend is complete (26 files, all passing). Build the React app foundation."

### Files to create in Phase 4:
1. `frontend/public/index.html` — Telegram WebApp SDK script tag, manifest link
2. `frontend/public/manifest.json`
3. `frontend/tailwind.config.js`
4. `frontend/postcss.config.js`
5. `frontend/src/index.js` — React root, QueryClient, i18next init
6. `frontend/src/index.css` — Tailwind directives + CSS custom properties for Telegram theme
7. `frontend/src/App.js` — Router, auth guard, route definitions
8. `frontend/src/i18n.js` — i18next setup with language detection
9. `frontend/src/locales/am.json` — Amharic (default, primary)
10. `frontend/src/locales/en.json` — English
11. `frontend/src/locales/om.json` — Afaan Oromo
12. `frontend/src/locales/ti.json` — Tigrinya
13. `frontend/src/context/authStore.js` — Zustand store (user, token, isLoading, login, logout)
14. `frontend/src/utils/api.js` — Axios instance with JWT interceptor + base URL
15. `frontend/src/utils/socket.js` — Socket.io client singleton
16. `frontend/src/utils/sections.js` — 16 section definitions (id, name, emoji, amharic, color)
17. `frontend/src/components/Layout.js` — Authenticated shell (sidebar + topbar + outlet)
18. `frontend/src/components/Sidebar.js` — Slide-in overlay with 16 sections + admin link
19. `frontend/src/components/TopBar.js` — User avatar, name, hamburger, notification badge
20. `frontend/src/components/BottomNav.js` — Home, Feed, Marketplace, Notifications, Profile

### Critical frontend rules for Phase 4:
- Call `window.Telegram.WebApp.ready()` and `.expand()` in index.js
- Read `tg.themeParams` to set CSS variables: `--tg-bg`, `--tg-text`, `--tg-hint`, `--tg-button`, `--tg-button-text`, `--tg-secondary-bg`
- Tailwind config must reference these CSS vars as color tokens
- Zustand store: persist token to localStorage; on load, restore token and call GET /api/users/me to rehydrate
- api.js: set `baseURL` to `process.env.REACT_APP_API_URL || ''` (empty = same origin in production)
- All Amharic strings in locales/am.json — never hardcode Amharic in JSX
- sections.js must export an array of 16 objects with `id` matching backend sectionId strings

### 16 sections reference (for sections.js):
```
{ id: 'spiritual-life',      emoji: '☦️',  amharic: 'መንፈሳዊ ሕይወት እና ሥነ-ምግባር',      english: 'Spiritual Life & Morality'     }
{ id: 'business-directory',  emoji: '🛒',  amharic: 'የነጋዴዎች መድረክ',                 english: 'Business Directory & B2B'      }
{ id: 'import-export',       emoji: '🚢',  amharic: 'አስመጭዎች እና ላኪዎች',              english: 'Import, Export & Trade'        }
{ id: 'education-training',  emoji: '👩‍🏫', amharic: 'ትምህርት እና ስልጠና',              english: 'Education & Training'          }
{ id: 'logistics-supply',    emoji: '🚛',  amharic: 'ትራንስፖርት እና አቅርቦት',           english: 'Logistics & Supply'            }
{ id: 'jobs-careers',        emoji: '💼',  amharic: 'የስራ ዕድል እና ቅጥር',             english: 'Jobs & Careers'                }
{ id: 'it-software',         emoji: '💻',  amharic: 'ቴክኖሎጂ እና ዲጂታላይዜሽን',         english: 'IT & Software Systems'         }
{ id: 'health-wellness',     emoji: '🏥',  amharic: 'ጤና እና ደህንነት',                english: 'Health & Wellness'             }
{ id: 'marketplace-b2c',     emoji: '🤝',  amharic: 'የገዢና ሻጭ ትስስር',               english: 'Marketplace / B2C'             }
{ id: 'banking-finance',     emoji: '💵',  amharic: 'ባንክ፣ ፋይናንስ እና ኦዲት',         english: 'Banking & Finance'             }
{ id: 'tenders-bids',        emoji: '📄',  amharic: 'ጨረታ እና የሥራ ኮንትራቶች',         english: 'Tenders & Contracts'           }
{ id: 'engineering-arch',    emoji: '📐',  amharic: 'ምህንድስና እና ዲዛይን',             english: 'Engineering & Architecture'    }
{ id: 'legal-property',      emoji: '⚖️',  amharic: 'የሕግ አማካሪዎች ቦርድ',            english: 'Legal & Property Rights'       }
{ id: 'trust-safety',        emoji: '🛡️',  amharic: 'የታማኝነት ቁጥጥር',               english: 'Trust & Safety'                }
{ id: 'business-development',emoji: '📈',  amharic: 'የንግድ እና የልማት ጥናት',          english: 'Business & Development'        }
{ id: 'healthcare-community', emoji: '🩺', amharic: 'የጤና እና ማህበራዊ አገልግሎት',        english: 'Healthcare & Community'        }
```

---

## 🔲 Phase 5 — Session 5: Core pages
Registration.js (with creed field), WelcomeScreen.js, Home.js, SectionChat.js,
MyFeed.js, Profile.js, Notifications.js, BannedScreen.js, Recovery.js,
PostCard.js, ChatComposer.js, ReactionBar.js, AnnouncementCard.js

## 🔲 Phase 6 — Session 6: Feature pages
Marketplace.js, MarketplaceDetail.js, Mentorship.js, LiveQA.js, Polls.js,
Bookings.js, ProfessionalApply.js, Donations.js

## 🔲 Phase 7 — Session 7: Admin panel + Service Worker + deploy docs
admin/* (9 files), public/sw.js, README.md
