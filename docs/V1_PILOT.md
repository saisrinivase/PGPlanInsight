# V1 internal pilot: pending green release candidate

Do not begin acceptance or label this a released V1 until both Windows and macOS release jobs pass on the exact pilot commit. Freeze that commit and retain its build, scoring report and hash manifest. Linux is not a V1 support target.

Recruit two or three engineers, including someone unfamiliar with execution plans. Use anonymized plans and optional reviewed context packs; do not run suggested SQL automatically or change production during the pilot.

Tasks without coaching:

1. Diagnose a slow indexed query. Identify the supporting operation, explain captured evidence versus hypotheses, and choose one controlled next check.
2. Assess an index suggestion with and without catalog context. Explain why a duplicate or unsupported index must not be created.
3. Compare a before/after plan. Reject a misleading one-run or non-comparable improvement; export the evidence and limitations.

Record participant role, OS/browser, exact commit, task, time to first correct investigation, wrong conclusions, help requests, keyboard/navigation failures, and report usability. Have a DBA review correctness independently; do not turn synthetic conformance into a production accuracy score.

Release decision: all tasks completed, no unresolved critical/high correctness, security or data-loss defects, and no misleading verified/causal claims. Agree remaining usability issues and known limitations with participants. Record actual results and sign-off; never prefill a pass.

Rollback: stop distribution of a failing candidate and return to the prior verified artifact. Preserve exported cases separately; do not clear browser history as part of rollback.
