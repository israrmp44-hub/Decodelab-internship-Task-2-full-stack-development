from pydantic import BaseModel, Field,EmailStr
from typing import Literal 


class CustomerCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=10, max_length=20)
    email: EmailStr | None = None

class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    phone: str | None = Field(default=None, min_length=10, max_length=20)
    email: EmailStr | None = None


RepairStatus = Literal[
    "Received",
    "In Progress",
    "On Hold",
    "Completed",
    "Delivered",
    "Cancelled"
]

class RepairCreate(BaseModel):
    customer_id: int = Field(gt=0)


    device_type: str = Field(min_length=2, max_length=50)
    brand: str = Field(min_length=2, max_length=50)
    model: str = Field(min_length=1, max_length=100)

    issue: str = Field(min_length=5, max_length=1000)

    estimated_cost: int = Field(ge=0)



class RepairUpdate(BaseModel):
    device_type: str | None = Field(default=None, min_length=2, max_length=50)
    brand: str | None = Field(default=None, min_length=2, max_length=50)
    model: str | None = Field(default=None, min_length=1, max_length=100)
    issue: str | None = Field(default=None, min_length=5, max_length=1000)

    status: RepairStatus | None = None

    estimated_cost: int | None = Field(default=None, ge=0)
    final_cost: int | None = Field(default=None, ge=0)


class PaymentCreate(BaseModel):
    repair_id: int = Field(gt=0)
    amount: int = Field(gt=0)
    method: Literal["Cash", "Bank Transfer", "Card", "Other"]