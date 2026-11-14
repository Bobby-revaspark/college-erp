# Full-stack acceptance checks

Run with VITE_DEMO_MODE=false and a seeded MySQL instance.

1. Anonymous GET /api/bootstrap returns 401. Login with each seeded role in separate browser sessions. Expired or logged-out sessions must return 401.
2. Student sees exactly their own record, attendance, timetable and receipts. POST /api/payments, /api/students and /api/attendance return 403 even when manually requested.
3. Faculty sees only students in assigned course/semesters and receives no payment transaction list. Marking another faculty's subject returns 403. Sending a student from a different course in a valid subject's attendance returns 400.
4. Accountant can collect fees but cannot register students, edit timetables or change roles.
5. Submit two simultaneous payments each greater than half a student's outstanding balance. Exactly one may succeed. The other returns 400 after checking the locked ledger. The total must never exceed the registered fee.
6. Duplicate non-cash transaction references return 409. Zero/negative amounts, missing references, and future dates return 400. Downloaded receipt must match the persisted payment.
7. Add a conflicting room, faculty or class lecture: 409. Adjacent non-overlapping lectures succeed. A subject from another course or an end time before start time returns 400.
8. Mark attendance, refresh and confirm persistence. Resubmit the same student/subject/date: update existing entry without duplicate rows.
9. Change a staff role with admin, then confirm the target's existing session is invalidated. An admin cannot change their own role or promote a student identity.
10. Verify filtered CSV/PDF reports against the ledger, including date and department boundaries. Open CSV in Excel and inspect values beginning with formula characters.
11. Test registration with an already used email, mismatched department/course and a course with no fee structure. Confirm no orphan user is created after failure.
12. Check mobile navigation, keyboard-only modal operation and validation feedback, and restart both processes to verify persistence.
