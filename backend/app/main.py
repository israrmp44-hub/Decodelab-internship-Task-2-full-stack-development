from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from app.database import create_tables
from app.routes import customers, repairs, payments, stats

app = FastAPI(
    title="SmartFix API",
    description="Backend RESTful API for SmartFix Service & Repair Management System",
    version="1.0.0"
)

# Enable CORS for local development across all standard ports
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database tables on startup
create_tables()

# Register API Routers
app.include_router(customers.router)
app.include_router(repairs.router)
app.include_router(payments.router)
app.include_router(stats.router)

# Mount frontend directory for full-stack access directly via FastAPI
FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/ui", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

@app.get("/")
def home():
    return {
        "message": "Welcome to SmartFix API",
        "status": "running",
        "docs_url": "/docs",
        "app_ui_url": "/ui/"
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }
