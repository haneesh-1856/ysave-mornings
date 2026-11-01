# YSave Mornings: technical documentation

These docs are the source of truth for building the app. The visual reference is the
working prototype `drafts/ysave-style-lab.html` (live: https://claude.ai/artifact/PpuUWCbgmWnDQBzp5oPPN7).
When these docs and the prototype disagree, **the docs win**. Fix the docs first, then the code.

| # | Doc | Answers |
|---|---|---|
| 01 | [Product spec](01-product-spec.md) | What v1 does and doesn't do |
| 02 | [Architecture](02-architecture.md) | Stack, layers, folders, how data flows |
| 03 | [Data model](03-data-model.md) | Tables, fields, invariants |
| 04 | [Domain rules](04-domain-rules.md) | Day boundary, planning, timer, closing, glow, collection |
| 05 | [Screens & navigation](05-screens-and-navigation.md) | Every screen, its routes, entries and exits |
| 06 | [Design system](06-design-system.md) | Tokens, the "look mix", components, motion |
| 07 | [Quality, security, testing](07-quality-security-testing.md) | Test strategy, privacy, accessibility, performance |
| 08 | [Dev setup & release](08-dev-setup-and-release.md) | Running on your phone, builds, versioning |
| 09 | [Open questions](09-open-questions.md) | Undecided items and the assumption used for now |
| 10 | [Decision log](10-decisions.md) | Why each technical choice was made |
| 11 | [Roadmap](11-roadmap.md) | Build milestones and their done-criteria |

## Ground rules

- **Philosophy is a requirement.** No points, prizes, leaderboards, streak-shaming, plan judging,
  suggestions, or automatic carry-forward of unfinished time (moving it is an explicit opt-in at close). A feature that breaks this is a bug.
- **Local-first.** v1 has no account, no server and no network calls. Everything is on the device.
- **Domain logic is pure TypeScript** with unit tests. Screens stay thin.
- **Any rule change updates [04](04-domain-rules.md) in the same commit as the code.**
