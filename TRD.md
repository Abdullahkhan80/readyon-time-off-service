# Technical Requirement Document (TRD): ReadyOn Time-Off Microservice

## 1. Executive Summary
The **ReadyOn Time-Off Microservice** is designed to manage the lifecycle of employee leave requests while maintaining high data consistency with an external **Human Capital Management (HCM)** system, which serves as the "Source of Truth" (SoT).

## 2. Product Context & User Needs
### 2.1 The Problem
Maintaining balance integrity between two disconnected systems is difficult. Out-of-band updates in the HCM (e.g., anniversary bonuses) can cause local balances to drift. Simultaneously, employees need instant feedback on requests, and managers need to approve requests knowing the data is valid and hasn't been "double-spent."

### 2.2 User Personas
- **The Employee**: Requires accurate balance visibility and immediate feedback on request submission.
- **The Manager**: Requires a guarantee that approved requests are backed by valid balances in the SoT.

## 3. System Architecture

### 3.1 Data Model
The system uses the following entities:
- **Employee**: Core user data.
- **TimeOffBalance**: Per-employee, per-location tracking. Features two balance types:
    - `balance`: The confirmed balance from HCM.
    - `reservedBalance`: The sum of hours currently "on hold" for pending requests.
- **TimeOffRequest**: Tracks the state machine status (`PENDING`, `APPROVED`, `REJECTED`, `SYNC_FAILED`).
- **AuditLog**: Immutable ledger of all balance mutations.
- **IdempotencyKey**: Ensures at-most-once execution of critical transactions.

### 3.2 The Reserved Balance Pattern
To solve the "double-spending" problem without keeping the user waiting for slow external APIs:
1. **On Request**: The system checks `available = balance - reservedBalance`. If sufficient, it increments `reservedBalance` and marks the request as `PENDING`.
2. **On Approval**: The system performs a real-time validation and deduction against the HCM.
3. **On Success**: The local `balance` and `reservedBalance` are both decremented, and the request is marked `APPROVED`.
4. **On Failure**: The `reservedBalance` is released, and the request is marked `SYNC_FAILED`.

## 4. Integration Strategy

### 4.1 Real-time Integration
- **Pre-flight Check**: Before approval, the service calls the HCM Real-time API to verify the balance hasn't changed independently.
- **Atomic Deduction**: Deduction is sent to HCM with a unique `requestId` to ensure idempotency on the external side.

### 4.2 Batch Reconciliation (Drift Compensation)
- **Snapshot Sync**: Periodically (and on startup), the service fetches the full corpus of balances from the HCM batch endpoint.
- **Correction Logic**: Any discrepancies between the local `balance` and HCM `balance` are overwritten, and an audit log is generated.

## 5. Technical Challenges & Solutions

### 5.1 Race Conditions
- **Challenge**: Multiple simultaneous requests for the same employee.
- **Solution**: 
    - **Local Mutex**: Uses `async-mutex` to serialize reservation logic within the process.
    - **Optimistic Locking**: Uses TypeORM `@VersionColumn` to prevent concurrent updates to the same balance row.

### 5.2 SQLite Concurrency
- **Challenge**: SQLite's limited support for high-concurrency writes.
- **Solution**: Enabled **WAL (Write-Ahead Logging) Mode** to allow simultaneous reads and writes, significantly improving performance for the microservice.

### 5.3 Idempotency
- **Challenge**: Network retries causing duplicate leave deductions.
- **Solution**: Mandatory `X-Idempotency-Key` for request creation and internal approval keys to ensure a request is only ever deducted once from the HCM.

## 6. Analysis of Alternatives

| Alternative | Pros | Cons | Decision |
| :--- | :--- | :--- | :--- |
| **Direct HCM Write** | Simplest logic. | Slow; no offline support; hard to handle partial failures. | ❌ Rejected |
| **Eventual Consistency** | High availability. | High risk of over-committing leave; poor UX for managers. | ❌ Rejected |
| **Reserved Balance** | High integrity; good UX; robust failure handling. | More complex state machine. | ✅ **Chosen** |

## 7. Security & Auditability
- **Audit Ledger**: Every mutation (reservation, deduction, rejection, sync) is recorded in an immutable `audit_logs` table.
- **Dimensions**: All balances are tracked per `employeeId` and `locationId` to support multi-regional enterprise requirements.

---
**Version**: 1.0.0  
**Author**: Abdullah  
