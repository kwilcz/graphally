# Brief: expense claim approval at Northwind

Draw the expense claim process as a BPMN swimlane diagram for the finance operations team.

Participants (lanes): **Employee**, **Line manager**, **Finance**, and the **ERP system**.

1. The employee **submits an expense claim** with receipts.
2. The ERP system **validates the claim** automatically (policy limits, receipts attached).
3. If validation fails, the employee is asked to **correct the claim** and resubmits (back
   to step 1).
4. If it passes, the line manager **reviews the claim**. If the manager does not act within
   3 days, a **reminder** is sent (timer) and the review continues.
5. The manager **approves or rejects**. A rejection **notifies the employee** and the
   process ends (claim rejected).
6. Approved claims **over £1,000** need a **finance review**; claims up to £1,000 go straight
   to payment.
7. Finance **approves or rejects** (rejection notifies the employee, as above).
8. The ERP system **schedules the payment** in the next payment run, and the employee
   **receives a payment notification**. The process ends (claim paid).

Show messages between participants as message flows. The deliverable is one SVG.
