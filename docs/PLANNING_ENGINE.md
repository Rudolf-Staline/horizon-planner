# Horizon Planning Engine — v1 contract

This document defines the scheduling behavior independently from React.

## Core distinction

An event has a `kind`:

- `fixed`: excluded from automatic movement.
- `flexible`: may be scheduled by the engine.

An event may additionally be `locked`. Locking is an interaction constraint, not a scheduling category: a locked event cannot be dragged or resized from the calendar until the user explicitly unlocks it.

## Hard constraints

A candidate placement is admissible only when all of these hold:

1. It fits entirely between `START_MIN` and `END_MIN`.
2. It fits inside `windowStartMin..windowEndMin` when a window exists.
3. Its day is between the task's current day and `deadlineDay`.
4. It does not overlap any other event.
5. The start time is aligned to the 15-minute planning grid.

Hard constraints are never violated to produce a result.

## Soft preferences

Among admissible candidates, lower score wins.

The v1 score uses:

- distance from the task's current day;
- distance from its current clock time;
- an energy/time-of-day preference;
- urgency derived from priority and remaining days before deadline.

Moving to another day carries a deliberately large penalty. Horizon should preserve the person's mental model of the week before optimizing secondary preferences.

## Energy windows

Current defaults:

- high energy → morning / first half of day;
- medium energy → middle of day;
- low energy → late afternoon / evening.

These are preferences, not hard restrictions.

## Splitting

A task is split only when:

- it is `flexible`;
- `splittable === true`;
- no single contiguous placement fits.

The engine attempts chunks up to 90 minutes and never intentionally creates a chunk smaller than `minChunkMin`, except for a final remainder smaller than that minimum.

Each accepted segment blocks its chosen slot before the engine searches for the next segment.

## Mutation rule

The scheduling module is pure. It does not write application state.

It returns one of:

- a single placement;
- a split plan;
- `null` when no admissible plan exists.

The UI/state layer decides whether to accept a proposal.

## Non-goals for v1

The engine does not yet model:

- travel time;
- location;
- calendar attendees;
- dependencies between tasks;
- recurring-event expansion;
- probabilistic duration;
- sleep constraints across midnight;
- multi-week planning;
- learned personal preferences.

These should be added explicitly rather than hidden inside opaque scoring weights.
