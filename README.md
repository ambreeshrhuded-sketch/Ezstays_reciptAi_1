# 🏨 HostelReceipt AI & Bank Reconciliation Engine

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Gemini API](https://img.shields.io/badge/Google%20GenAI-Gemini%203.1%20%2F%203.8-orange.svg)](https://ai.google.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Auth-ffca28.svg)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38b2ac.svg)](https://tailwindcss.com/)

A production-grade, full-stack intelligent data extraction and financial reconciliation platform built for educational institutions and hostel management. Automated multimodal AI transforms messy handwritten, stamped, or digital fee receipts into standardized 33-column accounting records, cross-referencing them against bank statement deposits for automated payment knocking.

---

## 🌟 Key Features

### 1. Multimodal AI Receipt Extraction
- **Zero-Shot OCR**: Powered by Google Gemini (`gemini-3.1-flash-lite` for ultra-fast ~2.4s extraction, with automatic escalation to `gemini-flash-latest` and `gemini-3.8-flash`).
- **Standardized Schema**: Extracts 33 structured financial fields including Student ID, Room/Bed, Nature of Fee, Handwritten vs. Printed Receipt Numbers, Total Fees, Amount Received, Mode of Payment (UPI/Cash/Bank Transfer), and Bank UTR/Reference Numbers.
- **Split Transaction Support**: Automatically extracts multi-part split payments (e.g., student paying ₹10,000 via UPI and ₹5,000 via Cash on a single receipt).
- **Client-Side Pre-Optimization**: Compresses 5–12MB mobile photos to lightweight ~100KB OCR-sharp JPEGs in the browser before upload, minimizing latency.

### 2. Automated Bank Reconciliation & Payment Knocking
- **Bank Statement Ingestion**: Parses HDFC, SBI, Axis, PhonePe, and generic statement formats from PDF, Excel, and CSV files.
- **Intelligent Knocking Engine**:
  - **Exact UTR / Reference Matching**: 100% confidence matching on transaction reference strings.
  - **Fuzzy Date & Amount Matching**: Detects matching deposits with configurable date tolerances (±1–3 days) and flags variances.
  - **Discrepancy Flagging**: Highlights amount mismatches, unknocked receipt payments, and unidentified bank credits.

### 3. Human-in-the-Loop Review & Duplicate Detection
- **Interactive Review Modal**: Side-by-side receipt image viewer with interactive bounding boxes and confidence score indicators per field.
- **Duplicate Prevention**: Multi-key hash detection flags potential duplicate entries based on receipt numbers and student payment dates.
- **5-Stage Pipeline Tracker**: Real-time visual progress monitoring from Ingestion &rarr; AI OCR &rarr; Human Verification &rarr; Bank Knocking &rarr; Excel Export.

### 4. Enterprise Excel Export Engine
- **33 Standardized Columns**: Generates master spreadsheets strictly formatted for university bursar and accounting software.
- **34th Clickable Receipt Link Column**: Direct hyperlinks back to original receipt images stored securely in the cloud.
- **Reconciliation Audit Columns**: Appends bank match status, verified bank source, matched UTR string, and knock decision timestamp.

---

## 🛠️ Architecture & Tech Stack

```text
┌────────────────────────────────────────────────────────┐
│                   React 19 Frontend                    │
│   (Vite, Tailwind CSS, Lucide Icons, Motion Animations) │
└───────────┬────────────────────────────────┬───────────┘
            │                                │
    Direct SDK Sync                   Secure Proxy Routes
            │                        (/api/extract-receipt,
            ▼                         /api/model-config)
┌────────────────────────┐                   ▼
│   Firebase Services    │       ┌───────────────────────┐
│ - Cloud Firestore      │       │     Express Engine    │
│ - Cloud Storage        │       │ - Low-latency Router  │
│ - Non-Anon Auth Rules  │       │ - Model Failover Logic│
└────────────────────────┘       └───────────┬───────────┘
                                             │
                                      Google GenAI SDK
                                             ▼
                                 ┌───────────────────────┐
                                 │   Gemini Multimodal   │
                                 │  - 3.1-flash-lite     │
                                 │  - 3.8-flash fallback │
                                 └───────────────────────┘
```

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite, Lucide React, Motion.
- **Backend / API**: Node.js Express server (`server.ts`) with development Vite middleware.
- **AI & Vision**: `@google/genai` TypeScript SDK with dynamic model routing and retry fallbacks.
- **Database & Storage**: Firebase Firestore with strict collection rules (`firestore.rules`) and Firebase Storage.
- **Export**: SheetJS (`xlsx`) for enterprise Excel workbook generation.

---

## 🚀 Quickstart & Setup

### Prerequisites
- Node.js (v18 or higher)
- npm or pnpm
- Google Gemini API Key ([Get one at Google AI Studio](https://aistudio.google.com/))
- Firebase Project (configured via `firebase-applet-config.json`)

### Installation
```bash
# Clone the repository
git clone https://github.com/your-username/hostel-receipt-ai.git
cd hostel-receipt-ai

# Install dependencies
npm install
```

### Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Add your Gemini API key:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

### Run Locally
```bash
# Start the local development server (binds to http://localhost:3000)
npm run dev
```

### Production Build
```bash
# Compile and bundle TypeScript & Vite assets
npm run build

# Start production server
npm start
```

---

## 📁 Project Structure

```text
├── src/
│   ├── components/
│   │   ├── reconciliation/      # Bank statement parsing & knocking UI
│   │   ├── DashboardView.tsx    # 5-stage pipeline & overview KPI cards
│   │   ├── UploadView.tsx       # Drag-and-drop receipt batch intake
│   │   ├── ReviewModal.tsx      # Side-by-side verification & editing
│   │   ├── ExportView.tsx       # 33-column Excel generation settings
│   │   └── SettingsView.tsx     # AI model selection & thresholds
│   ├── firebase/
│   │   ├── config.ts            # Firebase initialization
│   │   ├── receiptStore.ts      # Firestore receipts CRUD & indexing
│   │   └── reconciliationStore.ts # Bank statements & knocking decisions
│   ├── server/
│   │   ├── geminiExtractor.ts   # Core Gemini vision prompt & JSON parser
│   │   ├── modelRouter.ts       # Latency-aware failover router
│   │   └── statementAiExtractor.ts # Statement parser
│   ├── types/
│   │   ├── receipt.ts           # 33-column master interface
│   │   └── reconciliation.ts    # Knocking & statement data types
│   ├── utils/
│   │   ├── excelExporter.ts     # Master workbook generator
│   │   └── imageOptimizer.ts    # Client-side JPEG compressor
│   ├── App.tsx                  # Root state & concurrent worker pool
│   └── main.tsx                 # Client entry point
├── server.ts                    # Backend Express server with Vite middleware
├── firestore.rules              # Granular role-based security rules
├── storage.rules                # Partitioned image storage access rules
├── package.json                 # Dependencies and build scripts
└── tsconfig.json                # Strict TypeScript configuration
```

---

## 📄 License
This project is open-source under the MIT License.

