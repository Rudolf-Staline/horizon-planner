# Personal finances

The Finances screen records accounts with dated opening balances, booked and
planned operations, transfers, monthly category budgets, saving goals and
monthly recurring income or expenses. It never contacts a bank or moves money.

MAD, XOF, EUR and USD are kept separate. Monetary values are integer minor
units (whole francs for XOF). A foreign-currency transfer requires the explicit
amount received and a date; it never fabricates an exchange rate. Transfers
affect both account balances and do not count as income or expenses. Planned
income remains outside available balances until marked received.

The account's entire ledger is saved atomically in `finance_state`, using the
authenticated `save_finances` RPC and a revision comparison. A stale revision
fails without changing the ledger. RLS restricts select, insert and update to
the owner; anon has no table or function access. No permanent delete action is
exposed: accounts can be archived, operations cancelled and restored, and
recurrences paused.

The existing JSON backup includes the ledger. Imports validate the complete
financial payload before the first import write. Older backups lacking a
finances field leave the current ledger unchanged. There is no finance cache
in localStorage; a failed cloud read displays an error and cannot seed an empty
replacement. Simultaneous browser sessions use an explicit Recharger action
and optimistic concurrency instead of overwriting each other's edits.

Saving goals reflect the real balance of a chosen account, not a separate
invented saving amount. A dedicated account avoids counting the same funds
towards several goals. Recurrences generate planned operations once per month,
even if an existing occurrence was subsequently booked or cancelled.

The planner now reads account collections in stable 500-row pages. This is
needed for full-semester day plans that exceed the Data API's default limit.
An error on any page rejects the partial snapshot before synchronization.

Semester holiday labels and the generic Rattrapages period remain visible as
information rather than individual appointments. Explicit exam sessions keep
their fixed times. Free margins stay available to the planning engine; sleep
and recovery blocks still reserve their times, and do not inflate workload
analytics.
The day and week grids expand to show existing appointments outside the
preferred working hours, including overnight sleep and evening recovery.
The planning preferences remain unchanged.

Validation: monetary arithmetic, forecasts, dated balances, two-currency and
same-currency transfers, invalid backups, recurrence deduplication, complete
pagination and partial-read failure are covered by Vitest.
