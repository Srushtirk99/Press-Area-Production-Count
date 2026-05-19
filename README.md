# 🏭 PressBoard — Factory Production Monitoring System

A real-time factory floor production monitoring system built for press machine operations. PressBoard tracks machine output, manages work orders, generates reports, and displays live production metrics on a dashboard.

---

## 📸 Overview

PressBoard connects physical ESP32 button devices on press machines to a central server, recording every production event in real time. Managers can monitor machine efficiency, assign work orders, and download production reports — all from a web dashboard.

---

## 🚀 Features

- **Real-time Dashboard** — Live production counts, efficiency %, current run rate, and idle time per machine via Socket.IO
- **ESP32 Button Integration** — Physical press machines (1–5) send production events over Wi-Fi via HTTP
- **Auto-Tick Machines** — Non-button machines (6–8) simulate realistic production cycles with randomized variance
- **Work Order Management** — Create, assign, track, and close work orders per machine with target quantity tracking
- **Unallocated Production Tracking** — Logs production events that occur without an active work order
- **Alarm System** — Alerts for machines near target (≥90%), work orders exceeded, and idle machines
- **Reports** — Daily, weekly, monthly, and yearly production reports exportable as Excel and PDF
- **User Management** — Role-based access (admin/operator) with JWT authentication
- **OTP Password Reset** — Forgot password flow with email OTP verification

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express | REST API server |
| Socket.IO | Real-time dashboard updates |
| MySQL | Production data storage |
| JWT | Authentication |
| Bcrypt | Password hashing |
| Nodemailer | OTP email delivery |
| ExcelJS | Excel report generation |
| PDFKit + ChartJS | PDF report generation |
| Multer | Machine image uploads |

### Frontend
| Technology | Purpose |
|---|---|
| React | UI framework |
| Redux | State management |
| Socket.IO Client | Real-time data reception |
| Axios | API calls |

### Hardware
| Device | Purpose |
|---|---|
| ESP32 | Wi-Fi enabled button controller on each press machine |

---

## 📁 Project Structure

```
Press-Area-Production-Count/
├── backend/
│   ├── config/
│   │   └── db.js                  # MySQL connection pool
│   ├── controllers/
│   │   ├── authController.js      # Login, OTP, password reset
│   │   ├── machineController.js   # Machine CRUD
│   │   ├── dashboardController.js # Dashboard metrics
│   │   ├── workorderController.js # Work order management
│   │   ├── alarmController.js     # Alarm checks
│   │   └── reportController.js    # Excel & PDF reports
│   ├── db/
│   │   ├── queries.js             # Core DB queries (machines, users, hourly logs)
│   │   └── workorderQueries.js    # Work order & production log queries
│   ├── middleware/
│   │   └── authMiddleware.js      # JWT verification
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── machineRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── workorderRoutes.js
│   │   ├── alarmRoutes.js
│   │   ├── reportRoutes.js
│   │   ├── ProductionLogs.js
│   │   └── userRoutes.js
│   ├── uploads/                   # Machine images (gitignored)
│   ├── server.js                  # Main server entry point
│   └── package.json
└── frontend/
    ├── public/
    ├── src/
    │   ├── pages/                 # Dashboard, WorkOrders, Reports, etc.
    │   ├── redux/                 # Store and slices
    │   ├── utils/                 # Protected routes
    │   └── socket.js              # Socket.IO client setup
    └── package.json
```

---

## ⚙️ Getting Started

### Prerequisites
- Node.js v18+
- MySQL 8+
- npm

### 1. Clone the repository
```bash
git clone https://github.com/Srushtirk99/Press-Area-Production-Count.git
cd Press-Area-Production-Count
```

### 2. Setup Backend
```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` folder:
```env
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=pressboard
JWT_SECRET=your_jwt_secret_key
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_app_password
PORT=5000
```

Start the backend:
```bash
nodemon server.js
```

### 3. Setup Frontend
```bash
cd frontend
npm install
npm start
```

Frontend runs on `http://localhost:3000`
Backend runs on `http://localhost:5000`

---

## 🔌 ESP32 Integration

Each physical press machine runs an ESP32 that calls this endpoint on every button press:

```
GET http://<server-ip>:5000/press<machineId>/input
```

Example for machine 3:
```
GET http://192.168.1.100:5000/press3/input
```

The server handles debouncing (500ms) and simultaneous press detection automatically.

---

## 📊 How Production is Recorded

```
Button Press / Auto-Tick
        ↓
Debounce Check (500ms)
        ↓
Log to recent_presses (5-min dashboard metric)
        ↓
Active Work Order exists?
    ├── YES → Increment WO count + hourly log + production_logs
    └── NO  → Log to unallocated_production + hourly log
        ↓
Push updated dashboard to all connected browsers via Socket.IO
```

---

## 👥 User Roles

| Role | Access |
|---|---|
| Admin | Full access — machines, users, work orders, reports |
| Operator | Dashboard and work order viewing only |

---

## 📈 Reports

Reports can be generated for any date range:
- **Daily** — hourly breakdown per machine
- **Weekly / Monthly / Yearly** — aggregated production totals
- **Export formats** — Excel (.xlsx) and PDF with charts

---

## 🔒 Environment Variables

| Variable | Description |
|---|---|
| `DB_HOST` | MySQL host |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name |
| `JWT_SECRET` | Secret key for JWT signing |
| `EMAIL_USER` | Gmail address for OTP emails |
| `EMAIL_PASS` | Gmail app password |
| `PORT` | Server port (default: 5000) |

---

## 📝 License

This project is private and proprietary. All rights reserved.

---

Built with ❤️ for factory floor production monitoring.