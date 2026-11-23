# SmartFix – Service & Repair Management System

SmartFix is a full-stack service and repair management system designed for small electronics repair businesses. It helps manage customers, repair jobs, repair statuses, payments, revenue statistics, and exportable reports through a clean web interface and RESTful API.

## Features

### Dashboard & Analytics
- Live shop overview: total repairs, in-progress jobs, completed jobs, and pending payments.
- Real-time recent repairs feed with direct navigation.
- Real-time report metrics, breakdown by repair status, and total revenue vs pending balance.
- Print report capability for physical receipts and shop summaries.

### Customer Management
- Register new customers (with duplicate phone validation).
- View all registered customers with dynamic repair counts.
- Search customers in real time by name or phone.
- View detailed customer profile and their complete repair job history.
- Update customer information.
- Delete customers (protected by foreign-key integrity when repair jobs exist).

### Repair Management
- Register new repair jobs directly, with the option to pick an existing customer or auto-create a new one.
- Filter repairs by status: `Received`, `In Progress`, `On Hold`, `Completed`, `Delivered`, `Cancelled`.
- Search repairs in real time by customer name, phone, device brand, model, or problem description.
- Quick status updater modal with optional final cost adjustment.
- Delete repair jobs (protected by foreign-key integrity when payments exist).

### Payment Management
- Record payments per repair (Cash, Bank Transfer, Card, Other).
- Track total billed, total paid, and live balance due per repair job.
- View payment history per repair job with the ability to delete mistaken payment records.
- Retrieve global payment ledger for shop financial audits.

### Settings & Customization
- Shop branding: shop name, phone, email, and address.
- Appearance: Light mode and Dark mode with customizable accent color.
- Localization: Currency selection (PKR, USD, EUR, GBP, OMR, SAR, AED).
- Custom repair ID prefix (e.g., `SF-001`).
- Data backup: One-click export of all shop data (customers, repairs, payments, statistics) to JSON.

---

## Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (Modern ES6+, responsive mobile-first UI)
- **Backend**: Python 3, FastAPI, Uvicorn
- **Database**: SQLite (with foreign-key enforcement enabled via `PRAGMA foreign_keys = ON`)
- **Validation**: Pydantic v2
- **Testing**: Pytest, FastAPI TestClient
- **API Documentation**: Swagger UI & ReDoc

---

## Project Structure

```text
SmartFix/
├── frontend/
│   ├── index.html          # Main single-page application
│   ├── css/
│   │   └── style.css       # Full styling (light/dark mode, modals, responsive)
│   ├── js/
│   │   └── app.js          # Connected API client & UI event handlers
│   └── assets/             # Icons and media
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py         # FastAPI entry point, CORS, static file mounting
│   │   ├── database.py     # SQLite connection & table creation
│   │   ├── schemas.py      # Pydantic models & validation
│   │   └── routes/
│   │       ├── customers.py# Customer CRUD & repair history
│   │       ├── repairs.py  # Repair CRUD & status tracking
│   │       ├── payments.py # Payment ledger & balance calculations
│   │       └── stats.py    # Aggregated shop metrics & reporting
│   ├── tests/
│   │   ├── __init__.py
│   │   └── test_api.py     # Automated pytest test suite
│   ├── smartfix.db         # SQLite database file
│   └── .venv/              # Python virtual environment
├── requirements.txt
├── README.md
└── .gitignore
```

---

## Installation & Setup

1. **Navigate to the project directory:**
   ```bash
   cd "Smartfix Management system"
   ```

2. **Activate the virtual environment:**
   - On Windows (PowerShell):
     ```powershell
     backend\.venv\Scripts\Activate.ps1
     ```
   - On macOS/Linux:
     ```bash
     source backend/.venv/bin/activate
     ```

3. **Install dependencies (if not already installed):**
   ```bash
   pip install -r requirements.txt
   ```

---

## Running the Application

1. **Start the FastAPI backend server:**
   ```bash
   cd backend
   python -m uvicorn app.main:app --reload
   ```

2. **Access the application in your browser:**
   - **Full Application UI**: [http://127.0.0.1:8000/ui/](http://127.0.0.1:8000/ui/)
   - **Interactive API Documentation (Swagger UI)**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
   - **Alternative API Docs (ReDoc)**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

*(Note: You can also open `frontend/index.html` directly or via VS Code Live Server on `http://127.0.0.1:5500`, as CORS is enabled.)*

---

## Running Automated Tests

Run the test suite using `pytest`:
```bash
# From the project root
$env:PYTHONPATH="backend"; backend\.venv\Scripts\pytest.exe -v
```

All 4 test modules will run across isolated SQLite test instances covering:
- Customer lifecycle, search, and phone uniqueness constraints
- Repair lifecycle, status transitions, and customer repair counts
- Foreign key integrity (preventing orphaned repairs or payments)
- Payment calculation, balance deduction, and shop statistical metrics

---

## API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| **GET** | `/` | API status and links |
| **GET** | `/health` | Health check endpoint |
| **GET** | `/ui/` | Web application user interface |
| **GET** | `/api/v1/stats/` | Aggregated shop statistics & reports |
| **POST** | `/api/v1/customers/` | Create a new customer |
| **GET** | `/api/v1/customers/` | List all customers (with repair counts) |
| **GET** | `/api/v1/customers/{id}` | Get customer details and repair history |
| **PATCH** | `/api/v1/customers/{id}` | Update customer info |
| **DELETE** | `/api/v1/customers/{id}` | Delete customer (FK protected) |
| **POST** | `/api/v1/repairs/` | Create a new repair job |
| **GET** | `/api/v1/repairs/` | List all repairs (with customer & payment joins) |
| **GET** | `/api/v1/repairs/{id}` | Get repair details and payment ledger |
| **PATCH** | `/api/v1/repairs/{id}` | Update repair details, status, or final cost |
| **DELETE** | `/api/v1/repairs/{id}` | Delete repair job (FK protected) |
| **POST** | `/api/v1/payments/` | Record payment for a repair |
| **GET** | `/api/v1/payments/` | List all payment records (for shop audit) |
| **GET** | `/api/v1/payments/{repair_id}` | Get payment history & balance for a repair |
| **DELETE** | `/api/v1/payments/{id}` | Delete a specific payment record |
