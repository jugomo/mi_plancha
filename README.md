# mi_plancha

🇪🇸 Versión en español: [`README.es.md`](./README.es.md)

Real-time kitchen management system to optimize the use of a shared grill: maximize its throughput while serving orders in arrival order, with the flexibility to bump orders ahead and avoid excessive waits.

## Documentation

| Document | Contents |
|---|---|
| [`DOMAIN.md`](./DOMAIN.md) | Vision, roles, entities, functional flow, business rules, MVP scope |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Tech stack, zero-cost strategy, monorepo structure |
| [`ALGORITHM.md`](./ALGORITHM.md) | Cooking-suggestion algorithm |
| [`DATA_MODEL.md`](./DATA_MODEL.md) | Firestore data model, key transactions |
| [`USER_STORIES.md`](./USER_STORIES.md) | User stories per role, prioritized P0→P3 |
| [`PROGRESS.md`](./PROGRESS.md) | **Current implementation status** — start here to see where the project stands |

## Scheduling algorithm

Orders are served in FIFO order (by creation time), but the queue never blocks: if the order at the front doesn't fit in the grill's free capacity right now, it's skipped without holding up the orders behind it that do fit. This strategy is known as **backfilling** (common in batch job schedulers like Slurm/PBS), implemented here with a **greedy first-fit** allocation: each order line is evaluated in queue order and included if it fits in the available slot, without searching for the combination that best fills that slot.

To prevent a large order from waiting indefinitely for a big-enough slot, there's an **aging** mechanism: once its wait time exceeds the configured maximum, the order becomes "forced" and gets an overflow margin as a last resort.

Full details (formulas, edge cases, examples) are in [`ALGORITHM.md`](./ALGORITHM.md).

## Repository structure

```
apps/web/        Angular
apps/ios/         SwiftUI
apps/android/     Kotlin Jetpack Compose
firebase/         Firestore rules, indexes, config (Spark plan, no cost)
algorithm-spec/   Shared test cases for the suggestion algorithm
```

Note: per-client Firebase config files (`google-services.json`, `GoogleService-Info.plist`, etc.) are versioned in the repo when present — they aren't secrets (the real security lives in `firebase/firestore.rules`, not in hiding these keys).

## Resuming work

This project is carried out in work sessions with Claude Code. If you're picking it back up after a while (with or without memory of the previous conversation), the starting point is always **`PROGRESS.md`**.
