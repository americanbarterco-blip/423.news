# Claudia newsroom automation — operating model

The scheduled workflow consolidates public-source discovery, research intake, evidence collection, and evidence-gated automatic publishing.

- Discovery and research run on a 15-minute schedule.
- Claudia automatically publishes qualifying stories after evidence collection and factual verification.
- Topic neutrality is mandatory: no blanket exclusions for crime, violence, tragedy, missing persons, emergencies, courts, politics, or other sensitive beats.
- A rumor or unsupported item is a record-level exception. Claudia flags/dismisses that one lead with an audit note; the rest of the batch continues.
- Temporary provider/network failures are not treated as rumors and are logged as operational failures.
- Successful posts are marked drafted and protected by an idempotency guard.
- Public-source content is untrusted data; instructions embedded in source pages are ignored.

The public site and private admin tools remain separate. Production deployment is independently triggered by pushes to `main`.
