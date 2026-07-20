# Agent Instructions — Solar Orbit

## Authority and current phase

`SPEC.md` is the product source of truth. Read it completely before changing this repository.

The repository is currently in a **documentation-only phase**. The present task authorizes only the creation or revision of `SPEC.md` and `agent.md`, followed by committing and pushing those documents. It does not authorize implementation.

Until the user explicitly starts an implementation task, do not:

- create application or simulation source code;
- create a package manifest, lockfile, build configuration, test scaffold, generated astronomy data, or dependency installation;
- add UI mock implementations, proof-of-concept calculations, or executable snippets to the repository;
- interpret the successful documentation push as permission to begin coding.

After the documentation work is pushed, stop and wait for explicit user direction.

## Fixed requirements

Do not change these decisions without asking the user and revising `SPEC.md` first:

- include only the Sun and eight planets;
- use a two-dimensional, top-down presentation;
- target desktop web browsers first;
- support January 1, 2000 through January 1, 4000;
- use a heliocentric Keplerian model projected onto the ecliptic plane;
- compress orbital distances for readability;
- preserve true relative mean diameters for the Sun and all planets under one shared scale;
- use equally styled planet labels with leader arrows;
- select planets, not the Sun;
- continuously connect the selected planet to its physically nearest other planet;
- provide forward, reverse, pause, presets, a custom multiplier, and date/time jumping;
- show every planet with a nonzero nearest-duration percentage over the fixed analysis interval.

## Clarification rule

If a requested change is not specified and a choice could materially alter scientific behavior, scope, user experience, stored data, accessibility, or architecture, ask the user before implementing it. Record accepted product decisions in `SPEC.md` rather than leaving them only in chat.

Minor reversible implementation details may be chosen later when they do not conflict with the specification. Document meaningful assumptions in the relevant code or project documentation.

## Scientific integrity

- Keep physical coordinates separate from screen coordinates.
- Never calculate the nearest planet from visually compressed positions.
- Keep the body-size scale separate from the orbital-distance scale.
- Do not individually inflate small planet bodies; use labels, arrows, and enlarged invisible hit targets.
- Treat the Sun as the origin and exclude it from planet selection and nearest-planet statistics.
- Use a documented orbital-element source with appropriate date coverage. Do not invent coefficients or silently extrapolate them.
- Make percentage calculations reproducible, versioned, and independent of rendering frame rate.
- Do not market the Keplerian approximation as observatory-, navigation-, or mission-grade accuracy.

## Implementation rules for a future authorized phase

These rules become relevant only after the user explicitly authorizes implementation:

1. Start from the current `SPEC.md` and propose a small implementation plan.
2. Keep astronomy calculations in pure modules independent of React and Canvas.
3. Keep simulation time independent of frame rate and wall-clock rendering delays.
4. Keep the animated scene separate from semantic HTML controls and accessible text alternatives.
5. Version orbital inputs, model assumptions, and generated percentage data together.
6. Add tests before claiming a scientific or interaction requirement is complete.
7. Validate boundary dates, reverse playback, ties, rounding totals, and corrupted persisted state.
8. Do not add out-of-scope astronomical bodies or third-party services without user approval.

## Verification expectations for a future authorized phase

- Unit-test known orbital-position fixtures against the selected source and stated tolerances.
- Unit-test physical distance and nearest-neighbor selection independently of display transforms.
- Verify percentage convergence and ensure displayed values total exactly 100.0%.
- Test the inclusive display boundaries and half-open percentage interval.
- Test forward and reverse playback at every preset and with valid and invalid custom values.
- Test selection by visible body, label, leader arrow, keyboard, and accessible planet list.
- Test focus behavior, reduced motion, contrast, live announcements, and non-color state cues.
- Run visual checks at the minimum 1280 × 720 viewport and larger desktop sizes.

## Repository and delivery discipline

- Preserve user-authored changes and inspect the working tree before editing.
- Do not use destructive Git commands or rewrite shared history.
- Keep unrelated changes out of commits.
- Use concise commit messages that state the outcome.
- Before reporting completion, run the relevant validation, confirm the intended files are committed, and confirm the remote branch contains the commit.
- Never place credentials, tokens, private keys, or machine-specific secrets in the repository.

## Documentation-phase definition of done

For the current task, completion means:

1. `SPEC.md` reflects every product decision supplied by the user.
2. `agent.md` enforces the no-code gate and preserves the specification's invariants.
3. No application, simulation, build, dependency, test, or generated-data files have been added.
4. The two documentation files are committed and pushed to the requested GitHub repository.
5. The working tree is clean after the push.
