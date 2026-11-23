import sqlite3
from fastapi import APIRouter, HTTPException, status
from app.schemas import PaymentCreate
from app.database import get_connection

router = APIRouter(
    prefix="/api/v1/payments",
    tags=["Payments"]
)

# 1. RECORD A PAYMENT
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_payment(payment: PaymentCreate):
    connection = get_connection()
    try:
        repair = connection.execute(
            "SELECT * FROM repairs WHERE id = ?",
            (payment.repair_id,)
        ).fetchone()

        if repair is None:
            raise HTTPException(
                status_code=404,
                detail="Repair not found"
            )

        cursor = connection.execute(
            """
            INSERT INTO payments (repair_id, amount, method)
            VALUES (?, ?, ?)
            """,
            (
                payment.repair_id,
                payment.amount,
                payment.method
            )
        )
        connection.commit()

        saved_payment = connection.execute(
            "SELECT * FROM payments WHERE id = ?",
            (cursor.lastrowid,)
        ).fetchone()

        # Calculate updated total paid
        all_payments = connection.execute(
            "SELECT amount FROM payments WHERE repair_id = ?",
            (payment.repair_id,)
        ).fetchall()

        total_paid = sum(p["amount"] for p in all_payments)
        effective_cost = repair["final_cost"] if repair["final_cost"] is not None else repair["estimated_cost"]
        balance_due = max(0, effective_cost - total_paid)

        return {
            "message": "Payment recorded successfully",
            "payment": dict(saved_payment),
            "total_paid": total_paid,
            "balance_due": balance_due
        }
    finally:
        connection.close()

# 2. GET ALL PAYMENTS IN SYSTEM (FOR REPORTS / AUDIT)
@router.get("/")
def get_all_payments():
    connection = get_connection()
    try:
        payments = connection.execute(
            """
            SELECT 
                payments.*,
                repairs.brand,
                repairs.model,
                repairs.device_type,
                repairs.status AS repair_status,
                customers.name AS customer_name,
                customers.phone AS customer_phone
            FROM payments
            JOIN repairs ON payments.repair_id = repairs.id
            JOIN customers ON repairs.customer_id = customers.id
            ORDER BY payments.id DESC
            """
        ).fetchall()

        total_amount = sum(item["amount"] for item in payments)

        return {
            "total_payments_count": len(payments),
            "total_amount_collected": total_amount,
            "payments": [dict(item) for item in payments]
        }
    finally:
        connection.close()

# 3. GET PAYMENTS FOR A SPECIFIC REPAIR
@router.get("/{repair_id}")
def get_repair_payments(repair_id: int):
    connection = get_connection()
    try:
        repair = connection.execute(
            "SELECT * FROM repairs WHERE id = ?",
            (repair_id,)
        ).fetchone()

        if repair is None:
            raise HTTPException(
                status_code=404,
                detail="Repair not found"
            )

        payments = connection.execute(
            """
            SELECT * FROM payments
            WHERE repair_id = ?
            ORDER BY id DESC
            """,
            (repair_id,)
        ).fetchall()

        total_paid = sum(item["amount"] for item in payments)
        effective_cost = repair["final_cost"] if repair["final_cost"] is not None else repair["estimated_cost"]
        balance_due = max(0, effective_cost - total_paid)

        return {
            "repair_id": repair_id,
            "total_cost": effective_cost,
            "total_paid": total_paid,
            "balance_due": balance_due,
            "payments": [dict(item) for item in payments]
        }
    finally:
        connection.close()

# 4. DELETE A PAYMENT RECORD
@router.delete("/{payment_id}")
def delete_payment(payment_id: int):
    connection = get_connection()
    try:
        payment = connection.execute(
            "SELECT id FROM payments WHERE id = ?",
            (payment_id,)
        ).fetchone()

        if payment is None:
            raise HTTPException(
                status_code=404,
                detail="Payment record not found"
            )

        connection.execute(
            "DELETE FROM payments WHERE id = ?",
            (payment_id,)
        )
        connection.commit()

        return {
            "message": "Payment record deleted successfully"
        }
    finally:
        connection.close()
