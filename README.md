# 🗓️ ReadyOn Time-Off Microservice

### **High-Consistency Leave Orchestration for Enterprise HCM Systems**

![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white) 
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![TypeORM](https://img.shields.io/badge/Schema-TypeORM-orange?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## 📖 Table of Contents
- [1. Project Overview](#1-project-overview)
- [2. Architecture & Design Patterns](#2-architecture--design-patterns)
- [3. Key Features](#3-key-features)
- [4. Tech Stack](#4-tech-stack)
- [5. API Documentation](#5-api-documentation)
- [6. Database Schema](#6-database-schema)
- [7. HCM Integration Strategy](#7-hcm-integration-strategy)
- [8. Installation & Setup](#8-installation--setup)
- [9. Testing & Coverage](#9-testing--coverage)
- [10. Analysis of Alternatives](#10-analysis-of-alternatives)

---

## 🚀 1. Project Overview
The **ReadyOn Time-Off Microservice** is a production-grade backend system designed to bridge the gap between user-facing leave requests and external **Human Capital Management (HCM)** systems (e.g., Workday, SAP). 

In enterprise environments, the HCM is the **Source of Truth (SoT)**. This microservice implements a **distributed consistency strategy** to ensure that employee balances are never over-committed, even when the external HCM is slow or temporarily unavailable.

---

## 🏗️ 2. Architecture & Design Patterns

The system utilizes a **Modular Monolith** architecture with several sophisticated patterns to guarantee data integrity:

### **The Reserved Balance Pattern**
To prevent "double spending" during the approval window, we use a two-stage deduction process:

```mermaid
sequenceDiagram
    participant E as Employee
    participant S as Time-Off Service
    participant DB as SQLite (Local)
    participant HCM as HCM (External)

    E->>S: Request Time Off (10 hrs)
    S->>S: Check Available Balance
    S->>DB: Increment "Reserved Balance" (+10)
    S-->>E: Status: PENDING
    
    Note over S, HCM: Manager Approval Triggered
    
    S->>HCM: Validate & Deduct (10 hrs)
    HCM-->>S: Success (Tx: hcm-123)
    
    S->>DB: Finalize Deduction
    S->>DB: Clear Reserved Balance
    S-->>E: Status: APPROVED
```

### **Core Resiliency**
- **Optimistic Locking**: Prevents race conditions during simultaneous request updates using `@VersionColumn`.
- **Atomic Mutexes**: Serializes balance reservations to circumvent SQLite's concurrent transaction limitations.
- **Circuit Breaker (Opossum)**: Protects the system from cascading failures during HCM downtime.

---

## ✨ 3. Key Features
- ✅ **State Machine Request Lifecycle**: `SUBMITTED` → `PENDING` → `APPROVED` / `REJECTED`.
- ✅ **Real-time HCM Validation**: Approval is blocked if the HCM balance has changed out-of-band.
- ✅ **Batch Reconciliation**: Overwrites local drift with full HCM corpus snapshots.
- ✅ **Global Idempotency**: `X-Idempotency-Key` prevents duplicate deductions on retries.
- ✅ **Immutable Audit Logs**: Comprehensive history of every balance mutation.

---

## 🛠️ 4. Tech Stack
- **Framework**: [NestJS](https://nestjs.com/) (Node.js 18+)
- **ORM**: [TypeORM](https://typeorm.io/)
- **Database**: **SQLite** (Wired with WAL mode for peak performance)
- **Circuit Breaker**: [Opossum](https://github.com/nodeshift/opossum)
- **Testing**: [Jest](https://jestjs.io/) & [Supertest](https://github.com/visionmedia/supertest)

---

## 📡 5. API Documentation

### **Time-Off Lifecycle Endpoints**
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/time-off/balance` | Fetch current & reserved balances. |
| `POST` | `/time-off/request` | Submit new request (Triggers Reservation). |
| `POST` | `/time-off/approve/:id` | Execute multi-stage HCM synchronization. |
| `POST` | `/time-off/reject/:id` | Terminate request and release hold. |
| `POST` | `/time-off/sync` | Trigger full reconciliation with HCM. |

#### **Example: Create Request**
```bash
curl -X POST http://localhost:3000/time-off/request \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "123e4567-e89b-12d3-a456-426614174000",
    "locationId": "NY-01",
    "requestedHours": 16,
    "startDate": "2026-06-01",
    "endDate": "2026-06-03"
  }'
```

---

## 💾 6. Database Schema
- **Employee**: User identification and metadata.
- **TimeOffBalance**: Per-employee, per-location tracking. Includes `balance` vs `reservedBalance`.
- **TimeOffRequest**: Status tracking linked to HCM transaction IDs.
- **AuditLog**: Immutable record of all state changes.
- **IdempotencyKey**: Ensures "at-most-once" execution.

---

## 🔗 7. HCM Integration Strategy
The service implements **"Defensive Integration"**:
1. **Pre-flight Check**: Validates balance in HCM *before* starting the local transaction.
2. **Atomic Sync**: Only clears local reserved balances *after* HCM confirms deduction.
3. **Emergency Rollback**: If HCM fails during deduction, the local `reservedBalance` is automatically released.
4. **Drift Compensation**: Batch syncs correct anniversary bonuses or out-of-system changes.

---

## ⚙️ 8. Installation & Setup

```bash
# 1. Clone & Install
git clone https://github.com/Abdullahkhan80/readyon-time-off-service.git
cd readyon-time-off-service
npm install

# 2. Build & Initialize DB
npm run build

# 3. Start Development Mode
npm run start:dev
```

---

## 🧪 9. Testing & Coverage
We maintain a strict **90%+ coverage** for the core business logic.

```bash
# Run Unit Tests
npm run test

# Run E2E Integration Tests (includes Mock HCM)
npm run test:e2e

# Generate Coverage Report
npm run test:cov
```

---

## ⚖️ 10. Analysis of Alternatives

| Approach | Considerations | Decision |
| :--- | :--- | :--- |
| **Immediate Deduction** | Difficult to rollback; poor UX if sync fails. | ❌ Rejected |
| **Reserved Balance** | Ensures integrity; allows clear "Pending" state. | ✅ Chosen |
| **Optimistic Locking** | Scalable; avoids heavy DB row-level locks. | ✅ Chosen |
| **Batch Reconcile** | Essential for out-of-band HCM updates. | ✅ Chosen |

---

## 🛠️ Challenges Handled
- 🏁 **Race Conditions**: Solved via `async-mutex` and DB versioning.
- 📉 **HCM Outages**: Handled via Circuit Breakers and Retries.
- 🔄 **Data Drift**: Resolved through daily corpus reconciliation.
- 📑 **Auditability**: Guaranteed via immutable event logging.

---
Built with ❤️ for High-Consistency HR Systems.
