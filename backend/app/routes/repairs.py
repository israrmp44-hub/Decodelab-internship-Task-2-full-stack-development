import sqlite3
from fastapi import APIRouter, HTTPException, status
from app.schemas import RepairCreate, RepairUpdate
from app.database import get_connection

router = APIRouter(
    prefix="/api/v1/repairs",
    tags=["Repairs"]
)

# 1. CREATE REPAIR
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_repair(repair: RepairCreate):
    connection = get_connection()
    try:
        # Check whether customer exists
        customer = connection.execute(
            "SELECT id FROM customers WHERE id = ?",
            (repair.customer_id,)
        ).fetchone()

        if customer is None:
            raise HTTPException(
                status_code=404,
                detail="Customer not found"
            )

        # Insert repair into database
        cursor = connection.execute(
            """
            INSERT INTO repairs (
                customer_id,
                device_type,
                brand,
                model,
                issue,
                estimated_cost
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                repair.customer_id,
                repair.device_type.strip(),
                repair.brand.strip(),
                repair.model.strip(),
                repair.issue.strip(),
                repair.estimated_cost
            )
        )
        connection.commit()
        repair_id = cursor.lastrowid

        saved_repair = connection.execute(
            """
            SELECT 
                repairs.*,
                customers.name AS customer_name,
                customers.phone AS customer_phone,
                customers.email AS customer_email,
                0 AS total_paid
            FROM repairs
            JOIN customers ON repairs.customer_id = customers.id
            WHERE repairs.id = ?
            """,
            (repair_id,)
        ).fetchone()

        return {
            "message": "Repair created successfully",
            "repair": dict(saved_repair)
        }
    finally:
        connection.close()

# 2. GET ALL REPAIRS (WITH FILTERS, SEARCH, AND TOTAL PAID)
@router.get("/")
def get_repairs(status_filter: str | None = None, search: str | None = None):
    connection = get_connection()
    try:
        query = """
            SELECT 
                repairs.*,
                customers.name AS customer_name,
                customers.phone AS customer_phone,
                customers.email AS customer_email,
                COALESCE(SUM(payments.amount), 0) AS total_paid
            FROM repairs
            JOIN customers ON repairs.customer_id = customers.id
            LEFT JOIN payments ON repairs.id = payments.repair_id
        """
        params = []
        conditions = []

        if status_filter and status_filter.lower() != "all":
            conditions.append("repairs.status = ?")
            params.append(status_filter)

        if search:
            conditions.append(
                "(customers.name LIKE ? OR customers.phone LIKE ? OR repairs.brand LIKE ? OR repairs.model LIKE ? OR repairs.device_type LIKE ? OR repairs.issue LIKE ?)"
            )
            term = f"%{search.strip()}%"
            params.extend([term, term, term, term, term, term])

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " GROUP BY repairs.id ORDER BY repairs.id DESC"

        repairs = connection.execute(query, params).fetchall()

        return {
            "total": len(repairs),
            "repairs": [dict(repair) for repair in repairs]
        }
    finally:
        connection.close()

# 3. GET ONE REPAIR WITH PAYMENT HISTORY
@router.get("/{repair_id}")
def get_repair(repair_id: int):
    connection = get_connection()
    try:
        repair = connection.execute(
            """
            SELECT
                repairs.*,
                customers.name AS customer_name,
                customers.phone AS customer_phone,
                customers.email AS customer_email
            FROM repairs
            JOIN customers ON repairs.customer_id = customers.id
            WHERE repairs.id = ?
            """,
            (repair_id,)
        ).fetchone()

        if repair is None:
            raise HTTPException(
                status_code=404,
                detail="Repair not found"
            )

        repair_dict = dict(repair)

        # Get all payments for this repair
        payments = connection.execute(
            """
            SELECT * FROM payments
            WHERE repair_id = ?
            ORDER BY id DESC
            """,
            (repair_id,)
        ).fetchall()

        total_paid = sum(p["amount"] for p in payments)
        effective_cost = repair_dict["final_cost"] if repair_dict["final_cost"] is not None else repair_dict["estimated_cost"]
        balance_due = max(0, effective_cost - total_paid)

        repair_dict["payments"] = [dict(p) for p in payments]
        repair_dict["total_paid"] = total_paid
        repair_dict["balance_due"] = balance_due

        return {
            "repair": repair_dict
        }
    finally:
        connection.close()

# 4. UPDATE REPAIR
@router.patch("/{repair_id}")
def update_repair(repair_id: int, repair: RepairUpdate):
    connection = get_connection()
    try:
        existing = connection.execute(
            "SELECT * FROM repairs WHERE id = ?",
            (repair_id,)
        ).fetchone()

        if existing is None:
            raise HTTPException(
                status_code=404,
                detail="Repair not found"
            )

        updates = repair.model_dump(exclude_unset=True)

        if not updates:
            raise HTTPException(
                status_code=400,
                detail="No update information provided"
            )

        # Prevent changes to delivered or cancelled jobs unless updating status to reopen
        if existing["status"] in ["Delivered", "Cancelled"]:
            if "status" not in updates:
                raise HTTPException(
                    status_code=400,
                    detail="This repair is closed (Delivered/Cancelled) and cannot be modified without changing its status."
                )

        columns = ", ".join(f"{column} = ?" for column in updates)
        values = list(updates.values())
        values.append(repair_id)

        connection.execute(
            f"UPDATE repairs SET {columns} WHERE id = ?",
            values
        )
        connection.commit()

        updated = connection.execute(
            """
            SELECT 
                repairs.*,
                customers.name AS customer_name,
                customers.phone AS customer_phone,
                customers.email AS customer_email,
                COALESCE(SUM(payments.amount), 0) AS total_paid
            FROM repairs
            JOIN customers ON repairs.customer_id = customers.id
            LEFT JOIN payments ON repairs.id = payments.repair_id
            WHERE repairs.id = ?
            GROUP BY repairs.id
            """,
            (repair_id,)
        ).fetchone()

        return {
            "message": "Repair updated successfully",
            "repair": dict(updated)
        }
    finally:
        connection.close()

# 5. DELETE REPAIR
@router.delete("/{repair_id}")
def delete_repair(repair_id: int):
    connection = get_connection()
    try:
        existing = connection.execute(
            "SELECT id FROM repairs WHERE id = ?",
            (repair_id,)
        ).fetchone()

        if existing is None:
            raise HTTPException(
                status_code=404,
                detail="Repair not found"
            )

        try:
            connection.execute(
                "DELETE FROM repairs WHERE id = ?",
                (repair_id,)
            )
            connection.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete repair because it has payment records. Please remove payments first."
            )

        return {
            "message": "Repair deleted successfully",
            "repair_id": repair_id
        }
    finally:
        connection.close()
