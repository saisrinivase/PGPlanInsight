# V1 internal pilot: protocol and blank scorecard

## Readiness

Hosted desktop release-gate run #53 passed on Windows and macOS for commit `3547197`, with diagnostic-score artifacts for both platforms. Mobile browsers are outside the release matrix. This clears the CI prerequisite for an internal pilot of that build; it does not constitute human usability acceptance or release approval. The pilot scorecards below remain blank until real participants complete the sessions. Any source/documentation commit after `3547197` must pass a fresh gate before release approval. Linux is not a V1 support target.

Recruit two or three engineers, including at least one person unfamiliar with execution plans. Run sessions without coaching. Use synthetic/anonymized plans and optional reviewed context packs. Do not run suggested SQL automatically or change production during the pilot. Tell participants this evaluates the product, not their skill; ask them to think aloud, but do not explain terms or point to controls during a task.

Record the exact app commit and browser for each session. Use a fresh browser profile or clear only pilot case data between sessions. Do not retain participant names in the scorecard; use participant IDs. Obtain consent before recording a screen or collecting sensitive plan/context material.

## Neutral task prompts

Read only the quoted task to the participant. Give them the prepared synthetic/anonymized plan and context artifacts for the task. Do not mention tab names or expected answers. Start timing when the participant begins interacting; stop when they say they are done or ask for help.

The participant-only handout and fictional input files are in [docs/pilot-artifacts](pilot-artifacts/PARTICIPANT_TASKS.md). Share that handout, not this protocol or the observer rubric. The fixtures use fictional `public.orders`, `public.order_items`, and generated measurements; they are for workflow usability only, not diagnostic accuracy scoring.

1. **Investigate the slow query:** “Use this plan to explain what work you would investigate first. Show me the plan operation that supports your view, what the plan directly tells you, what remains uncertain, and what you would check next.”
2. **Assess an index hypothesis:** “Review this plan and decide what you would investigate before changing an index. First use the plan without the supplied metadata. Then add the supplied database context and explain whether it changes your next step.”
3. **Review a proposed improvement:** “Compare these before and after plans. Decide what conclusion the evidence supports, what you would do next, and prepare a record you could share with a reviewer.”

## Observer rubric

Mark each item pass, partial, fail, or not observed. Do not coach during scoring. A participant may complete a task with a different but evidence-consistent explanation; note their reasoning for DBA review rather than forcing the wording below.

| Task | Evidence of completion |
|---|---|
| 1 | Finds the relevant operation or recognizes when an exact link is unavailable; cites captured runtime/work such as rows, loops, reads, heap fetches, or filtering; distinguishes observation from suspected cause; proposes one bounded next check. |
| 2 | Does not treat an index label alone as proof; states what is unknown without context; after context, notices equivalent existing coverage or explains why additional index evidence is insufficient; does not interpret a candidate as an executed or guaranteed fix. |
| 3 | Notices the missing comparability declaration or repetition; rejects an unsupported improvement claim; identifies blockers/unknowns; can find and export the validation report and describe its limitations. |

For every task, record time to first relevant evidence and total completion time, wrong or overconfident conclusions, requests for help, terminology confusion, keyboard/focus/navigation failures, and participant comments. Ask after each task: “What, if anything, was unclear?” and “What would you expect to happen next?” Do not lead with a list of features.

## Blank session scorecard

Copy one block per participant. Leave unknown fields blank; do not prefill a pass.

| Field | Record |
|---|---|
| Participant ID / role |  |
| Familiarity with EXPLAIN plans |  |
| OS / browser and version |  |
| App commit / build |  |
| Context-pack artifact ID, if used |  |
| Consent for notes / recording |  |

| Task | Result (pass/partial/fail) | Time to first evidence | Total time | Wrong conclusions / uncertainty | Help requests | Keyboard or navigation issues | Participant wording / notes |
|---|---|---|---|---|---|---|---|
| 1. Slow query |  |  |  |  |  |  |  |
| 2. Index with/without context |  |  |  |  |  |  |  |
| 3. Before/after comparison |  |  |  |  |  |  |  |

| Closing question | Record |
|---|---|
| Most useful part |  |
| Least clear or trustworthy part |  |
| Would you use this in a real investigation? Why/why not? |  |
| Report/export usability |  |
| Observer follow-up / defect IDs |  |

## Automated dry-run evidence (not participant evidence)

On 2026-10-08, the three task flows were replayed in Chromium against synthetic fixtures: exact operation navigation, existing-index qualification after context import, and a one-run before/after comparison that must remain inconclusive. All three existing Playwright workflows passed. This verifies interaction paths only; it does not establish usability, participant success, or diagnostic accuracy.

## Review and decision

Have a DBA review correctness independently. Do not convert synthetic conformance or this small pilot into a production accuracy score. Triage observations by severity and task impact; fix only blockers or misleading interpretations before the release candidate freeze, and track the rest with owners and dates.

Release decision: all tasks completed, no unresolved critical/high correctness, security, or data-loss defects, and no misleading verified/causal claims. Agree remaining usability issues and known limitations with participants. Record actual results and sign-off; never prefill a pass.

Rollback: stop distribution of a failing candidate and return to the prior verified artifact. Preserve exported cases separately; do not clear browser history as part of rollback.
