# Performance

Driftile gates operation counts instead of wall-clock time. This keeps the
budgets stable across development machines, CI runners, and KWin's JavaScript
engine.

## Reference suite

| Workload                 | Shape                                                                 | Budget                                                                                              |
| ------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Startup scale            | 1 output, 1 context, 1,000 singleton windows                          | At most 2 scheduler callbacks and 2 work-area reads; exactly 1,000 initial writes                   |
| Ownership classification | 1 context, 96 changed windows                                         | At most 8 classification reads per window; exactly 96 writes                                        |
| Lifecycle endurance      | 128 add, activate, minimize, restore, remove, focus, and probe cycles | At most 1,024 callbacks; empty queue, exact baseline recovery, zero settled writes, and no warnings |
| Visible burst            | 2 outputs, 2 visible contexts, 1 new window in each                   | 1 callback, exactly 2 writes, and no repeat write to either resident window                         |
| Automatic height         | 1 stack, 128 weighted windows, 64 tail minimum clamps                 | At most 3 height-policy reads per window                                                            |

The startup workload is a synthetic scale guard. Its 1,000 singleton columns
exceed the persisted per-context limit and are not a recommended user layout.

Run only these budgets with:

```bash
npm run performance:check
```

The standard `npm run check` verifies the performance manifest and runs the
same cases as part of the full unit suite. Absolute compositor latency, real
application startup, rendering, memory profiling, and hardware hotplug remain
outside this deterministic gate.
