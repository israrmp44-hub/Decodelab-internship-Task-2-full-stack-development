import sqlite3
from fastapi import APIRouter
from app.database import get_connection

router = APIRouter(
    prefix="/api/v1/stats",
    tags=["Statistics"]
)

@router.get("/")
def get_shop_statistics():
    """
    Returns real aggregated statistics for the shop dashboard and reports.
    """
    connection = get_connection()
    try:
        # Total repairs count
        total_repairs = connection.execute(
            "SELECT COUNT(*) AS count FROM repairs"
        ).fetchone()["count"]

        # Counts by status
        status_rows = connection.execute(
            "SELECT status, COUNT(*) AS count FROM repairs GROUP BY status"
        ).fetchall()
        status_counts = {row["status"]: row["count"] for row in status_rows}

        # Customers count
        total_customers = connection.execute(
            "SELECT COUNT(*) AS count FROM customers"
        ).fetchone()["count"]

        # Payments total received
        revenue_row = connection.execute(
            "SELECT COALESCE(SUM(amount), 0) AS total_revenue FROM payments"
        ).fetchone()
        total_revenue = revenue_row["total_revenue"]

        # Total estimated / final costs for repairs
        cost_row = connection.execute(
            """
            SELECT 
                COALESCE(SUM(CASE WHEN final_cost IS NOT NULL THEN final_cost ELSE estimated_cost END), 0) AS total_billed
            FROM repairs
            WHERE status != 'Cancelled'
            """
        ).fetchone()
        total_billed = cost_row["total_billed"]

        # Pending amount = total billed minus total revenue collected
        pending_amount = max(0, total_billed - total_revenue)

        return {
            "total_repairs": total_repairs,
            "received": status_counts.get("Received", 0),
            "in_progress": status_counts.get("In Progress", 0),
            "on_hold": status_counts.get("On Hold", 0),
            "completed": status_counts.get("Completed", 0),
            "delivered": status_counts.get("Delivered", 0),
            "cancelled": status_counts.get("Cancelled", 0),
            "total_customers": total_customers,
            "total_revenue": total_revenue,
            "total_billed": total_billed,
            "pending_amount": pending_amount
        }
    finally:
        connection.close()
