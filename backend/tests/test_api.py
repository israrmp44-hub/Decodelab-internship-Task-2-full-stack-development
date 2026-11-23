import os
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

# Use an isolated test database for tests
TEST_DB = Path(__file__).resolve().parent / "test_smartfix.db"
os.environ["SMARTFIX_DB_PATH"] = str(TEST_DB)

from app.main import app
from app.database import create_tables, get_connection

@pytest.fixture(autouse=True, scope="module")
def setup_test_database():
    if TEST_DB.exists():
        TEST_DB.unlink()
    create_tables()
    yield
    if TEST_DB.exists():
        TEST_DB.unlink()

@pytest.fixture
def client():
    return TestClient(app)

def test_root_and_health(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"

    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "healthy"

def test_customer_lifecycle(client):
    # 1. Create a customer
    res = client.post("/api/v1/customers/", json={
        "name": "Hamza Tariq",
        "phone": "03009876543",
        "email": "hamza@example.com"
    })
    assert res.status_code == 201
    customer_id = res.json()["customer"]["id"]
    assert customer_id > 0

    # 2. Prevent duplicate phone
    dup_res = client.post("/api/v1/customers/", json={
        "name": "Hamza Duplicate",
        "phone": "03009876543",
        "email": "dup@example.com"
    })
    assert dup_res.status_code == 409

    # 3. Get customer list and verify total_repairs is returned
    list_res = client.get("/api/v1/customers/")
    assert list_res.status_code == 200
    customers = list_res.json()["customers"]
    found = next((c for c in customers if c["id"] == customer_id), None)
    assert found is not None
    assert "total_repairs" in found
    assert found["total_repairs"] == 0

    # 4. Search customer by phone
    phone_res = client.get("/api/v1/customers/?phone=03009876543")
    assert phone_res.status_code == 200
    assert len(phone_res.json()["customers"]) == 1

    # 5. Search customer by name
    name_res = client.get("/api/v1/customers/?search=Hamza")
    assert name_res.status_code == 200
    assert len(name_res.json()["customers"]) >= 1

    # 6. Get customer details
    detail_res = client.get(f"/api/v1/customers/{customer_id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["name"] == "Hamza Tariq"
    assert "repairs" in detail_res.json()

    # 7. Update customer
    patch_res = client.patch(f"/api/v1/customers/{customer_id}", json={
        "name": "Hamza Tariq Updated"
    })
    assert patch_res.status_code == 200
    assert patch_res.json()["customer"]["name"] == "Hamza Tariq Updated"

def test_repair_lifecycle_and_constraints(client):
    # Create a customer first
    c_res = client.post("/api/v1/customers/", json={
        "name": "Zubair Ahmad",
        "phone": "03331122334",
        "email": "zubair@example.com"
    })
    cust_id = c_res.json()["customer"]["id"]

    # 1. Create repair
    r_res = client.post("/api/v1/repairs/", json={
        "customer_id": cust_id,
        "device_type": "Mobile Phone",
        "brand": "Google",
        "model": "Pixel 7 Pro",
        "issue": "Cracked OLED display screen",
        "estimated_cost": 15000
    })
    assert r_res.status_code == 201
    repair_id = r_res.json()["repair"]["id"]

    # Verify customer's total_repairs is now 1
    c_list = client.get(f"/api/v1/customers/{cust_id}")
    assert c_list.json()["total_repairs"] == 1

    # 2. Get repair details
    detail = client.get(f"/api/v1/repairs/{repair_id}")
    assert detail.status_code == 200
    assert detail.json()["repair"]["brand"] == "Google"
    assert detail.json()["repair"]["customer_name"] == "Zubair Ahmad"
    assert detail.json()["repair"]["balance_due"] == 15000

    # 3. Update repair status
    update_res = client.patch(f"/api/v1/repairs/{repair_id}", json={
        "status": "In Progress"
    })
    assert update_res.status_code == 200
    assert update_res.json()["repair"]["status"] == "In Progress"

    # 4. Filter repairs by status
    filter_res = client.get("/api/v1/repairs/?status_filter=In Progress")
    assert filter_res.status_code == 200
    assert any(r["id"] == repair_id for r in filter_res.json()["repairs"])

    # 5. Attempt to delete customer while repair exists (FK restriction)
    del_c_res = client.delete(f"/api/v1/customers/{cust_id}")
    assert del_c_res.status_code == 400
    assert "existing repair jobs" in del_c_res.json()["detail"].lower()

    # 6. Record a payment
    p_res = client.post("/api/v1/payments/", json={
        "repair_id": repair_id,
        "amount": 5000,
        "method": "Cash"
    })
    assert p_res.status_code == 201
    payment_id = p_res.json()["payment"]["id"]
    assert p_res.json()["total_paid"] == 5000
    assert p_res.json()["balance_due"] == 10000

    # 7. Attempt to delete repair while payment exists (FK restriction)
    del_r_res = client.delete(f"/api/v1/repairs/{repair_id}")
    assert del_r_res.status_code == 400
    assert "payment records" in del_r_res.json()["detail"].lower()

    # 8. Delete payment and then delete repair
    del_p_res = client.delete(f"/api/v1/payments/{payment_id}")
    assert del_p_res.status_code == 200

    del_r_ok = client.delete(f"/api/v1/repairs/{repair_id}")
    assert del_r_ok.status_code == 200

    # 9. Now delete customer succeeds
    del_c_ok = client.delete(f"/api/v1/customers/{cust_id}")
    assert del_c_ok.status_code == 200

def test_payments_and_stats(client):
    # Create test customer and repair
    c_res = client.post("/api/v1/customers/", json={
        "name": "Noman Ali",
        "phone": "03215566778"
    })
    cust_id = c_res.json()["customer"]["id"]

    r_res = client.post("/api/v1/repairs/", json={
        "customer_id": cust_id,
        "device_type": "Laptop",
        "brand": "Dell",
        "model": "XPS 15",
        "issue": "Motherboard short circuit",
        "estimated_cost": 25000
    })
    repair_id = r_res.json()["repair"]["id"]

    p_res = client.post("/api/v1/payments/", json={
        "repair_id": repair_id,
        "amount": 10000,
        "method": "Bank Transfer"
    })
    assert p_res.status_code == 201

    # Check stats endpoint
    stats_res = client.get("/api/v1/stats/")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total_repairs"] >= 1
    assert stats["total_customers"] >= 1
    assert stats["total_revenue"] >= 10000

    # Check all payments list
    all_p = client.get("/api/v1/payments/")
    assert all_p.status_code == 200
    assert len(all_p.json()["payments"]) >= 1

    # Check payment for specific repair
    r_payments = client.get(f"/api/v1/payments/{repair_id}")
    assert r_payments.status_code == 200
    assert r_payments.json()["total_paid"] == 10000
    assert r_payments.json()["balance_due"] == 15000
