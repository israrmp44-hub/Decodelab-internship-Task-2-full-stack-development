import sqlite3
from fastapi import APIRouter, status, HTTPException, Query
from app.schemas import CustomerCreate, CustomerUpdate
from app.database import get_connection

router = APIRouter(
    prefix="/api/v1/customers",
    tags=["Customers"]
)

# 1. CREATE CUSTOMER
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_customer(customer: CustomerCreate):
    connection = get_connection()
    try:
        cursor = connection.execute(
            """
            INSERT INTO customers (name, phone, email)
            VALUES (?, ?, ?)
            """,
            (
                customer.name.strip(),
                customer.phone.strip(),
                str(customer.email).strip() if customer.email else None
            )
        )
        connection.commit()
        customer_id = cursor.lastrowid

        saved_customer = connection.execute(
            "SELECT * FROM customers WHERE id = ?",
            (customer_id,)
        ).fetchone()

        return {
            "message": "Customer created successfully",
            "customer": dict(saved_customer)
        }
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="A customer with this phone number already exists."
        )
    finally:
        connection.close()

# 2. READ ALL CUSTOMERS (WITH REPAIR COUNT & FILTERING)
@router.get("/")
def get_customers(search: str | None = None, phone: str | None = None):
    connection = get_connection()
    try:
        query = """
            SELECT 
                customers.*,
                COUNT(repairs.id) AS total_repairs
            FROM customers
            LEFT JOIN repairs ON customers.id = repairs.customer_id
        """
        params = []
        conditions = []

        if phone:
            conditions.append("customers.phone = ?")
            params.append(phone.strip())
        elif search:
            conditions.append("(customers.name LIKE ? OR customers.phone LIKE ?)")
            term = f"%{search.strip()}%"
            params.extend([term, term])

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " GROUP BY customers.id ORDER BY customers.id DESC"

        rows = connection.execute(query, params).fetchall()

        return {
            "total": len(rows),
            "customers": [dict(row) for row in rows]
        }
    finally:
        connection.close()

# 3. GET ONE CUSTOMER WITH REPAIR HISTORY
@router.get("/{customer_id}")
def get_customer(customer_id: int):
    connection = get_connection()
    try:
        row = connection.execute(
            "SELECT * FROM customers WHERE id = ?",
            (customer_id,)
        ).fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Customer not found"
            )

        customer_dict = dict(row)

        repairs = connection.execute(
            """
            SELECT 
                repairs.*,
                COALESCE(SUM(payments.amount), 0) AS total_paid
            FROM repairs
            LEFT JOIN payments ON repairs.id = payments.repair_id
            WHERE repairs.customer_id = ?
            GROUP BY repairs.id
            ORDER BY repairs.id DESC
            """,
            (customer_id,)
        ).fetchall()

        customer_dict["repairs"] = [dict(r) for r in repairs]
        customer_dict["total_repairs"] = len(repairs)

        return customer_dict
    finally:
        connection.close()

# 4. UPDATE CUSTOMER
@router.patch("/{customer_id}")
def update_customer(customer_id: int, customer: CustomerUpdate):
    updates = customer.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=400,
            detail="No update information provided"
        )

    connection = get_connection()
    try:
        existing = connection.execute(
            "SELECT id FROM customers WHERE id = ?",
            (customer_id,)
        ).fetchone()

        if existing is None:
            raise HTTPException(
                status_code=404,
                detail="Customer not found"
            )

        columns = ", ".join(f"{column} = ?" for column in updates)
        values = list(updates.values())
        values.append(customer_id)

        try:
            connection.execute(
                f"UPDATE customers SET {columns} WHERE id = ?",
                values
            )
            connection.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(
                status_code=409,
                detail="A customer with this phone number already exists."
            )

        updated = connection.execute(
            "SELECT * FROM customers WHERE id = ?",
            (customer_id,)
        ).fetchone()

        return {
            "message": "Customer updated successfully",
            "customer": dict(updated)
        }
    finally:
        connection.close()

# 5. DELETE CUSTOMER
@router.delete("/{customer_id}")
def delete_customer(customer_id: int):
    connection = get_connection()
    try:
        existing = connection.execute(
            "SELECT id FROM customers WHERE id = ?",
            (customer_id,)
        ).fetchone()

        if existing is None:
            raise HTTPException(
                status_code=404,
                detail="Customer not found"
            )

        try:
            connection.execute(
                "DELETE FROM customers WHERE id = ?",
                (customer_id,)
            )
            connection.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete customer because they have existing repair jobs. Please delete their repairs first."
            )

        return {
            "message": "Customer deleted successfully"
        }
    finally:
        connection.close()
