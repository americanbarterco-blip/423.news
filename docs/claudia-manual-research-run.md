# Claudia manual research execution
This workflow is deliberately **manual only**. It will not execute until a human explicitly dispatches it and confirms the task-queue and task-claim migrations have been applied in Supabase.
It runs syntax/unit tests, then attempts a bounded batch (1–5) of research tasks using service-role credentials. Evidence collection is not verification and the workflow does not publish.
Do not confirm migration completion unless both migrations have actually been reviewed/applied.
