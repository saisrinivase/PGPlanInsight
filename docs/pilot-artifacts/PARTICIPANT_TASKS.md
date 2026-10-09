# PGPlan Insight internal pilot tasks

These are fictional examples prepared only for evaluating the interface. They are not production plans, diagnostic benchmarks, or evidence of product accuracy. Do not run SQL or make database changes. Your feedback on the interface is more important than reaching a particular answer.

## Task 1: Investigate a slow query

Open a new analysis and use [Task 1 plan](task-1-slow-query.json).

> Use this plan to explain what work you would investigate first. Show me the plan operation that supports your view, what the plan directly tells you, what remains uncertain, and what you would check next.

## Task 2: Review an index hypothesis

Open a new analysis and use [Task 2 plan](task-2-plan-without-context.json). First review it without importing metadata. Then open Database context and import [Task 2 context pack](task-2-context-pack-v1.json). Compare your interpretation before and after adding context.

> Review this plan and decide what you would investigate before changing an index. First use the plan without the supplied metadata. Then add the supplied database context and explain whether it changes your next step.

## Task 3: Compare before and after

Open a new analysis with [Task 3 before plan](task-3-before-plan.json). Open Validate fix and provide [Task 3 after plan](task-3-after-plan.json). The capture notes say the SQL shape and representative parameter set were the same. There was one after execution only; settings, cache state, and concurrency were not recorded.

> Compare these before and after plans. Decide what conclusion the evidence supports, what you would do next, and prepare a record you could share with a reviewer.

## After each task

Please think aloud as you work. The facilitator will not explain terminology or point out controls during a task. When finished, describe anything that was confusing, surprising, or missing. The exercise evaluates the product, not your skill.
