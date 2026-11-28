# 🚀 WebSentry AI

### AI-Powered Web Application Analyzer

**Scan Smarter. Fix Faster. Build Better.**

**Project ID:** `DNHN6J`

WebSentry AI is an intelligent web application analyzer designed to inspect websites and identify potential quality issues using browser automation, performance analysis and accessibility testing.

---

## 🌟 Features

- 🔍 Automated Website Scanning
- 🎨 UI Consistency Analysis
- ♿ Accessibility Testing using axe-core
- ⚡ Website Performance Analysis
- 🔗 Broken Link Detection
- 🖼️ Broken Image Detection
- 📝 Missing Image Alt Attribute Detection
- 🐛 Browser Console Error Detection
- 📸 Desktop and Full-Page Screenshots
- 📊 Website Analysis Results

---

## 🛠️ Technologies Used

### Frontend
- React.js
- Vite
- HTML
- CSS
- JavaScript

### Backend
- Node.js
- Express.js
- Playwright
- axe-core

### Database
- MySQL

### Development Tools
- Git
- GitHub
- Antigravity IDE
- Visual Studio Code

---

## 📂 Project Structure

```text
WebSentry-AI/
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── config/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── server.js
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## ⚙️ Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/sakthysabarish/WebSentry-AI.git
```

### 2. Open the Project

```bash
cd WebSentry-AI
```

### 3. Install Backend Dependencies

```bash
cd backend
npm install
```

### 4. Configure Environment Variables

Create a `.env` file inside the `backend` folder.

Configure your MySQL database credentials and other required environment variables according to your backend configuration.

> ⚠️ **Never upload your `.env` file to GitHub.**

```env
PORT=5000
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=ai_web_analyzer
```

### 5. Start the Backend

```bash
npm run dev
```

Backend runs at: `http://localhost:5000`

### 6. Install Frontend Dependencies

Open another terminal:

```bash
cd frontend
npm install
```

### 7. Start the Frontend

```bash
npm run dev
```

Frontend runs at: `http://localhost:5173`

---

## 🔄 How It Works

1. Register a website URL through the dashboard.
2. Start the website analysis by clicking **Analyze**.
3. Playwright opens and inspects the registered website in a headless browser.
4. The analyzer collects performance, UI, and browser information.
5. axe-core runs an accessibility audit within the same browser session.
6. The AI recommendation engine maps each violation to actionable fixes.
7. Full analysis results — including screenshots, scores, and recommendations — are returned for review.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/projects` | Register a new website project |
| `GET` | `/api/projects` | Retrieve all registered projects |
| `GET` | `/api/projects/:id` | Retrieve a project by ID |
| `DELETE` | `/api/projects/:id` | Delete a project by ID |
| `POST` | `/api/analyze/:projectId` | Run full website analysis |

---

## 📊 Analysis Output

Each scan returns:

- **Performance Metrics** — Page load time, Web Vitals (LCP, FCP, TBT, CLS, TTI)
- **Link Analysis** — Internal/external links, broken links count
- **Image Analysis** — Total images, broken images, missing alt attributes
- **Console & Network** — Browser console errors, failed network requests
- **Accessibility Audit** — axe-core score (0–100), categorized violations
- **AI Recommendations** — Per-violation explanations, WCAG criteria, before/after code examples
- **Screenshots** — Desktop viewport and full-page captures

---

## 🎯 Project Objective

The main objective of WebSentry AI is to simplify website quality testing by combining browser automation, accessibility analysis, and intelligent recommendations in one platform.

---

## 👨‍💻 Developer

**Sakthy Sabarish S**

- 🐙 GitHub: [github.com/sakthysabarish](https://github.com/sakthysabarish)
- 💼 LinkedIn: [linkedin.com/in/sakthysabarishs01](https://linkedin.com/in/sakthysabarishs01)

---

⭐ If you find this project interesting, consider giving it a star!
