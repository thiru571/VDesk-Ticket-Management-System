# 🎫 TicketDesk — Production IT Ticket Management System

A full-stack, production-grade employee-facing IT support ticket system built with the MERN stack.

---

## 🏗 Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | React 18 + Vite                     |
| Styling     | Vanilla CSS (BEM, CSS Variables)    |
| Backend     | Node.js + Express                   |
| Database    | MongoDB + Mongoose                  |
| Real-time   | Socket.io                           |
| Email       | Gmail API (OAuth2) + Nodemailer     |
| Auth        | JWT (Bearer tokens)                 |
| File Upload | Multer (local disk)                 |

---

## 📁 Project Structure

```
ticket-system/
├── backend/
│   ├── config/
│   │   ├── database.js          # MongoDB connection
│   │   └── socket.js            # Socket.io setup + helpers
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── ticket.controller.js
│   │   ├── comment.controller.js
│   │   ├── dashboard.controller.js
│   │   ├── notification.controller.js
│   │   ├── user.controller.js
│   │   └── knowledge.controller.js
│   ├── middleware/
│   │   ├── auth.middleware.js   # JWT protect + authorize
│   │   ├── upload.middleware.js # Multer config
│   │   ├── errorHandler.js
│   │   └── notFound.js
│   ├── models/
│   │   ├── User.model.js
│   │   ├── Ticket.model.js
│   │   ├── Comment.model.js
│   │   ├── Notification.model.js
│   │   └── KnowledgeBase.model.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── ticket.routes.js
│   │   ├── comment.routes.js
│   │   ├── user.routes.js
│   │   ├── notification.routes.js
│   │   ├── dashboard.routes.js
│   │   ├── email.routes.js
│   │   └── knowledge.routes.js
│   ├── services/
│   │   ├── priority.service.js      # Smart scoring engine
│   │   ├── notification.service.js  # In-app + socket notifications
│   │   ├── email.service.js         # Gmail send
│   │   ├── emailPoller.service.js   # Gmail → ticket conversion
│   │   ├── assignment.service.js    # Auto-assign logic
│   │   └── slaMonitor.service.js    # Background SLA checker
│   ├── uploads/                     # Uploaded files
│   ├── .env.example
│   ├── package.json
│   └── server.js
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   └── common/
    │   │       └── AppLayout.jsx    # Sidebar + Header shell
    │   ├── context/
    │   │   ├── AuthContext.jsx
    │   │   ├── SocketContext.jsx
    │   │   └── ToastContext.jsx
    │   ├── pages/
    │   │   ├── LoginPage.jsx
    │   │   ├── RegisterPage.jsx
    │   │   ├── DashboardPage.jsx
    │   │   ├── TicketsPage.jsx
    │   │   ├── TicketDetailPage.jsx
    │   │   ├── CreateTicketPage.jsx
    │   │   ├── KnowledgePage.jsx
    │   │   ├── KnowledgeArticlePage.jsx
    │   │   ├── ProfilePage.jsx
    │   │   ├── AdminUsersPage.jsx
    │   │   └── NotFoundPage.jsx
    │   ├── services/
    │   │   ├── api.js               # Axios instance
    │   │   └── ticketService.js     # All API calls
    │   ├── styles/
    │   │   ├── global.css           # Variables, reset, animations
    │   │   ├── layout.css           # Sidebar, header, grid
    │   │   ├── components.css       # Buttons, cards, forms, modals
    │   │   └── pages.css            # Page-specific styles
    │   ├── utils/
    │   │   └── helpers.js           # Date, SLA, formatting utils
    │   ├── App.jsx
    │   └── main.jsx
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## 🚀 Setup Instructions

### 1. Prerequisites
- Node.js >= 18
- MongoDB (local or Atlas)
- Gmail account (for email features — optional)

### 2. Clone & install

```bash
# Backend
cd ticket-system/backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Configure backend environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/ticket_system
JWT_SECRET=your_very_long_secret_key_here
FRONTEND_URL=http://localhost:5173

# Optional: Gmail API (for email-to-ticket and notifications)
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret
GMAIL_REDIRECT_URI=http://localhost:5000/api/auth/gmail/callback
GMAIL_REFRESH_TOKEN=your_refresh_token
SUPPORT_EMAIL=support@yourcompany.com
```

### 4. Seed demo data (optional)

```bash
# From backend directory
node seed.js
# Creates: admin@demo.com, agent@demo.com, employee@demo.com
# Password for all: Demo1234!
```

### 5. Start servers

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- Health check: http://localhost:5000/api/health

---

## 🔑 Default Roles & Permissions

| Role          | Capabilities                                              |
|---------------|-----------------------------------------------------------|
| employee      | Create tickets, view own tickets, comment, reopen, rate   |
| support_agent | View all tickets, update status, assign, internal notes   |
| admin         | Full access + user management + delete tickets            |

---

## 📡 API Reference

### Auth
| Method | Endpoint              | Auth | Description          |
|--------|-----------------------|------|----------------------|
| POST   | /api/auth/register    | No   | Register user        |
| POST   | /api/auth/login       | No   | Login, returns JWT   |
| GET    | /api/auth/me          | Yes  | Get current user     |
| PUT    | /api/auth/profile     | Yes  | Update profile       |
| PUT    | /api/auth/change-password | Yes | Change password  |

### Tickets
| Method | Endpoint                     | Auth       | Description               |
|--------|------------------------------|------------|---------------------------|
| GET    | /api/tickets                 | Yes        | List (with filters/sort)  |
| POST   | /api/tickets                 | Yes        | Create ticket (multipart) |
| GET    | /api/tickets/:id             | Yes        | Get single ticket         |
| DELETE | /api/tickets/:id             | Admin      | Delete ticket             |
| PATCH  | /api/tickets/:id/status      | Agent/Admin| Update status             |
| PATCH  | /api/tickets/:id/assign      | Agent/Admin| Assign to agent           |
| PATCH  | /api/tickets/:id/priority    | Agent/Admin| Override priority         |
| PATCH  | /api/tickets/:id/reopen      | Creator    | Reopen resolved ticket    |
| POST   | /api/tickets/:id/feedback    | Creator    | Submit rating + feedback  |
| POST   | /api/tickets/suggest-priority| Yes        | Auto-detect priority      |
| GET    | /api/tickets/similar         | Yes        | Find similar tickets      |

### Comments
| Method | Endpoint              | Auth   | Description         |
|--------|-----------------------|--------|---------------------|
| GET    | /api/comments/:ticketId| Yes  | Get all comments    |
| POST   | /api/comments/:ticketId| Yes  | Add comment         |
| PUT    | /api/comments/:id     | Author | Edit comment        |
| DELETE | /api/comments/:id     | Auth   | Soft delete comment |

### Dashboard
| Method | Endpoint                  | Auth       | Description          |
|--------|---------------------------|------------|----------------------|
| GET    | /api/dashboard/employee   | Yes        | Employee stats       |
| GET    | /api/dashboard/admin      | Agent/Admin| Admin analytics      |
| GET    | /api/dashboard/workload   | Admin      | Agent workload table |

### Notifications
| Method | Endpoint                  | Auth | Description          |
|--------|---------------------------|------|----------------------|
| GET    | /api/notifications        | Yes  | Get notifications    |
| PATCH  | /api/notifications/read   | Yes  | Mark as read         |
| DELETE | /api/notifications/:id    | Yes  | Delete notification  |

### Users (Admin)
| Method | Endpoint           | Auth  | Description      |
|--------|--------------------|-------|------------------|
| GET    | /api/users         | Admin | List all users   |
| GET    | /api/users/agents  | Staff | Get agents       |
| PUT    | /api/users/:id     | Admin | Update user role |

### Knowledge Base
| Method | Endpoint              | Auth       | Description       |
|--------|-----------------------|------------|-------------------|
| GET    | /api/knowledge        | Yes        | List articles     |
| GET    | /api/knowledge/search | Yes        | Search articles   |
| POST   | /api/knowledge        | Agent/Admin| Create article    |
| GET    | /api/knowledge/:id    | Yes        | Get article       |
| PUT    | /api/knowledge/:id    | Agent/Admin| Update article    |
| POST   | /api/knowledge/:id/rate| Yes       | Rate helpful/not  |

---

## 🧠 Priority Scoring Formula

```
FinalScore = (Impact × 5) + (Urgency × 4) + (SLA Risk × 6) + Role Modifier + min(Queue Bonus, 20) + Keyword Bonus
```

| Component     | Range  | Notes                              |
|---------------|--------|------------------------------------|
| Impact        | 1–5    | just_me → company-wide             |
| Urgency       | 1–5    | flexible → right_now               |
| SLA Risk      | 1–5    | hours remaining vs deadline        |
| Role Modifier | 0–5    | admin > agent > employee           |
| Queue Bonus   | 0–20   | older tickets get bumped           |
| Keyword Bonus | -3–10  | "server down" +10, "printer" -3    |

| Score Range | Priority  |
|-------------|-----------|
| ≥ 60        | 🔴 Critical|
| 35–59       | 🟠 High    |
| 15–34       | 🟡 Medium  |
| < 15        | 🟢 Low     |

---

## ⏱ SLA Deadlines

| Priority | Resolution SLA |
|----------|----------------|
| Critical | 1 hour         |
| High     | 4 hours        |
| Medium   | 24 hours       |
| Low      | 3 days         |

---

## 🔌 Socket.io Events

### Server → Client
| Event              | Payload                    | Description                  |
|--------------------|----------------------------|------------------------------|
| notification       | {type, title, message, ...}| New notification             |
| ticket_created     | {ticketId, title, priority}| New ticket created           |
| status_updated     | {ticketId, status, ...}    | Ticket status changed        |
| new_comment        | {comment, ticketId}        | New comment added            |
| ticket_assigned    | {ticketId, assignedTo}     | Ticket assigned              |
| sla_warning        | {ticketId, deadline}       | SLA approaching              |
| priority_updated   | {ticketId, priority}       | Priority changed             |

### Client → Server
| Event        | Payload      | Description               |
|--------------|--------------|---------------------------|
| join_ticket  | ticketId     | Subscribe to ticket room  |
| leave_ticket | ticketId     | Unsubscribe from room     |

---

## 📧 Gmail API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → Enable Gmail API
3. Create OAuth2 credentials (Desktop app)
4. Get refresh token using OAuth playground
5. Add credentials to `.env`

The email poller runs every 5 minutes (configurable via `EMAIL_POLL_INTERVAL` in ms).

---

## 🏭 Production Deployment

```bash
# Build frontend
cd frontend && npm run build

# Serve with nginx or copy dist/ to backend/public/

# Backend with PM2
cd backend
npm install -g pm2
pm2 start server.js --name ticketdesk
pm2 save
```

Environment variables to change for production:
- `NODE_ENV=production`
- `JWT_SECRET` — use a 64+ character random string
- `MONGO_URI` — use MongoDB Atlas connection string
- `FRONTEND_URL` — your actual domain

---

## ✅ Features Checklist

- [x] JWT authentication (register/login/profile)
- [x] Role-based access (Employee / Agent / Admin)
- [x] Smart ticket creation with auto-priority scoring
- [x] Duplicate detection while typing
- [x] Knowledge Base suggestions before ticket submit
- [x] KB acknowledgement checkbox
- [x] Category-aware dynamic form (IT: device fields, etc.)
- [x] Impact scope + urgency selectors
- [x] File attachments (drag & drop)
- [x] Auto ticket assignment (workload + expertise)
- [x] Real-time updates via Socket.io
- [x] SLA tracking + countdown timers
- [x] SLA breach auto-escalation to Critical
- [x] Background SLA monitor (every 15 min)
- [x] Priority score breakdown + audit trail
- [x] Threaded comments with @mentions
- [x] Internal agent notes (hidden from employees)
- [x] Status timeline history
- [x] Ticket reopen with reason
- [x] 1–5 star feedback + close ticket
- [x] Email confirmation on create (Gmail API)
- [x] Email-to-ticket conversion (Gmail poller)
- [x] In-app notification panel
- [x] Dashboard analytics (employee + admin views)
- [x] 7-day trend chart
- [x] Category + priority breakdowns
- [x] Agent workload management
- [x] Admin user management (role + expertise)
- [x] Knowledge Base CRUD
- [x] Full-text search across tickets
- [x] Advanced filtering + sorting
- [x] BEM vanilla CSS (no Tailwind)
- [x] Mobile responsive design
- [x] Toast notifications
- [x] Rate limiting + helmet security
