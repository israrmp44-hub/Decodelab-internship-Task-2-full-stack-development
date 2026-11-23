import os
import sqlite3 
from pathlib import Path

# Base directory for the backend
BASE_DIR = Path(__file__).resolve().parent.parent

# Default database file location
DEFAULT_DB_PATH = BASE_DIR / "smartfix.db"

def get_db_path() -> Path:
    env_path = os.getenv("SMARTFIX_DB_PATH")
    if env_path:
        return Path(env_path)
    return DEFAULT_DB_PATH

def get_connection():
    connection = sqlite3.connect(get_db_path())

    # Return rows as dictionary-like objects
    connection.row_factory = sqlite3.Row

    # Enable foreign key support
    connection.execute("PRAGMA foreign_keys = ON")

    return connection

def create_tables():
    connection = get_connection()

    try:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS customers(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT NOT NULL UNIQUE,
                email TEXT
            )
        """)

        # Create repairs table
        connection.execute("""
            CREATE TABLE IF NOT EXISTS repairs(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER NOT NULL,
                device_type TEXT NOT NULL,
                brand TEXT NOT NULL,
                model TEXT NOT NULL,
                issue TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Received',
                estimated_cost INTEGER NOT NULL DEFAULT 0,
                final_cost INTEGER,
                FOREIGN KEY (customer_id)
                    REFERENCES customers(id)
                    ON DELETE RESTRICT
            )
        """)

        # Create payments table
        connection.execute("""
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                repair_id INTEGER NOT NULL,
                amount INTEGER NOT NULL CHECK(amount > 0),
                method TEXT NOT NULL,
                payment_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (repair_id)
                    REFERENCES repairs(id)
                    ON DELETE RESTRICT
            )
        """)

        connection.commit()
    finally:
        connection.close()
