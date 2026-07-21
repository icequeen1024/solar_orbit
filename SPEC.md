# Solar Orbit — Product Specification

Version: 1.1

Status: Approved; implementation in progress

Date: July 21, 2026

## 1. Product summary

Solar Orbit is a desktop-first, two-dimensional web experience that shows the Sun and the eight planets moving through a readable representation of the Solar System. A user can change the simulated flow of time, jump to a date, select a planet, see which other planet is physically nearest to it, and review the cumulative percentage of time each other planet has been nearest from January 1, 2000 through the displayed instant.

The experience should feel astronomical and believable while remaining readable. Orbital distances may therefore be compressed for display, but planet and Sun diameters must retain their real proportions under one shared body-size scale. Labels and leader arrows make small bodies findable.

## 2. Fixed product decisions

| Area | Decision |
| --- | --- |
| Bodies in scope | The Sun, Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune |
| Presentation | Two-dimensional, top-down view of the ecliptic plane |
| Primary platform | Desktop web browser |
| Hosting | Static deployment on GitHub Pages at the `solar_orbit` project path, compatible with Actions artifacts and branch-root publishing |
| Analysis range | January 1, 2000 through January 1, 4000 |
| Position model | NASA/JPL approximate heliocentric Keplerian elements (Table 2a/2b), projected into two dimensions |
| Distance presentation | Compressed for readability; not shown at literal distance scale |
| Body presentation | All nine bodies use one uniform visual size scale so their diameter ratios remain physically proportional; this includes the Sun |
| Labels | Equal typography and visual weight, with a leader arrow pointing to each body's position |
| Selection | Included planets are selectable; the Sun is displayed but is not a selectable planet or a nearest-planet candidate |
| Planet filtering | The right-side planet rail can include or exclude planets from selection, nearest-neighbor results, and cumulative statistics; excluded planets remain visible but dimmed |
| Nearest connection | Updates continuously while simulated time advances |
| Cumulative percentages | Start all other included alternatives at 0.0% on January 1, 2000 and update their nearest-duration shares through the displayed instant |

## 3. Goals

- Make the changing spatial relationships among the eight planets easy to explore.
- Let users move through two millennia in either direction at useful speeds.
- Clearly identify the nearest planet to a selected planet at the displayed instant.
- Explain, with deterministic live percentages, how often each other planet has been the selected planet's nearest neighbor since January 1, 2000.
- Preserve truthful relative body diameters while using labels and display scaling to keep the system understandable.
- Clearly distinguish physical calculations from visual distortion.

## 4. Non-goals

- A three-dimensional view.
- Moons, dwarf planets, asteroids, comets, spacecraft, or bodies outside the specified nine.
- Photorealistic rendering.
- Mission planning, navigation, eclipse prediction, or observatory-grade ephemerides.
- N-body perturbation simulation, general relativity, barycentric motion, or planet rotation.
- Literal simultaneous scale for both body diameters and orbital distances.
- Mobile-first layout in the initial release.

## 5. Scientific model

### 5.1 Coordinates and orbital motion

- The Sun is the fixed origin of a heliocentric coordinate system.
- Each planet follows a Keplerian orbit calculated from the NASA/JPL Solar System Dynamics approximate elements and secular rates in Table 2a/2b.
- The source fit is valid through 3000 CE. The product extrapolates its secular rates from 3000 through 4000 CE and must visibly disclose that positions in the extrapolated period are illustrative.
- Three-dimensional orbital positions are projected onto the ecliptic plane for the two-dimensional display and distance calculations.
- Positions must be continuous between displayed dates; advancing time must not visibly jump between coarse precomputed samples.
- All calculations use UTC and the proleptic Gregorian calendar. Leap seconds are outside the product's required precision.
- This is an educational Keplerian approximation, not an observatory or navigation tool. The interface must make that limitation available in an information panel.

### 5.2 Display and cumulative intervals

- Users may display and jump to any instant from `2000-01-01T00:00:00Z` through `4000-01-01T00:00:00Z`, inclusive.
- At any displayed instant after the start, percentage calculations cover the half-open interval from `2000-01-01T00:00:00Z` up to the displayed instant. At exactly the start instant, the elapsed interval is zero and all seven displayed percentages are 0.0%.
- The simulation starts at January 1, 2000 at 00:00:00 UTC on a new visit unless a previously saved in-range date is restored.
- Reaching either endpoint while playing automatically pauses at that endpoint. The simulation never wraps around.

### 5.3 Visual scale

Two independent transforms are required:

1. **Body-size scale:** Apply one uniform scale factor to the physical mean diameters of the Sun and all eight planets. No body may receive an individual enlargement or minimum-size substitution in the orbital scene. The Sun must therefore retain its true diameter ratio to Jupiter, Earth, and the other planets. Rings may be decorative but do not change Saturn's diameter or physical position.
2. **Orbital-distance scale:** Apply a documented monotonic compression, such as a logarithmic or power scale, so inner and outer orbits can be understood in one view. The transform must preserve radial order but does not claim to preserve distance ratios.

Labels and leader arrows—not individually inflated planet markers—are the required way to locate bodies that render very small. The interface must display a concise disclosure such as “Orbital distances compressed; body diameters proportionally scaled.”

### 5.4 Nearest-planet calculation

- “Nearest” means the smallest center-to-center Euclidean distance in the physical heliocentric coordinate system at the displayed instant.
- The selected planet, the Sun, and user-excluded planets are excluded. The candidates are the other currently included planets.
- At least two planets must remain included so every selected planet has at least one candidate. Excluding the selected planet clears the selection.
- Screen-space positions and compressed display distances must never be used to decide which planet is nearest.
- If two candidates are equal within the numeric tolerance, use a documented, stable order by distance and then planet order from Mercury through Neptune. A tie indicator may be shown, but the connecting line must remain deterministic.
- At every animation update, recompute or interpolate the physical positions, determine the current nearest planet, and update the line and selected-planet panel together.

### 5.5 Percentage calculation

For each selectable planet, calculate how long each of the other currently included planets has been its nearest neighbor from the range start through the displayed instant.

- Percentages are time-weighted and derived from the displayed date, not visual frames or the path the user took through playback.
- Use a deterministic sampling interval no larger than six simulated hours. Refine detected distance-order transitions to within one simulated minute.
- Run a convergence check with a finer interval before release. No displayed one-decimal-place percentage may change by more than 0.1 percentage point under the finer calculation.
- Store a reproducible distance-order timeline for the full supported range so the nearest candidate can be deterministically re-evaluated for any valid included-planet set. Calculate each live percentage as `nearest duration since range start / elapsed duration since range start × 100`.
- Changing the included-planet set recomputes the entire displayed interval from January 1, 2000 with the new candidate set. Results must not depend on when or in which playback direction the user changed a filter.
- Show every other included planet, including those with zero accumulated duration. Excluded planets make no sampling contribution and do not appear in the percentage list.
- Show one decimal place by default. At the range start all values are 0.0%. After elapsed time is nonzero, use a consistent largest-remainder adjustment so visible values sum to exactly 100.0%.
- Sort entries by descending percentage, breaking equal displayed values by Mercury-to-Neptune order.
- The percentages update with the displayed instant during forward and reverse playback and immediately after a date jump or reset.
- The interface must provide an explanation of the cumulative interval, sampling method, orbital model, and rounding behavior.

## 6. User experience

### 6.1 Initial state

- The full system view opens with the Sun centered and all eight orbital paths represented.
- All eight planets initially participate in nearest-neighbor calculations.
- The initial date is January 1, 2000 at 00:00:00 UTC unless an in-range saved state is restored.
- Time is paused.
- No planet is selected, so no nearest-planet connecting line or selection card is visible.
- Selecting a planet at the initial instant shows all seven alternatives at 0.0% until simulated time advances.
- Equal-size labels identify every planet and use leader arrows that terminate at the corresponding physical position.

### 6.2 Selecting a planet

- A planet can be selected by clicking its rendered body, label, or leader arrow.
- An excluded planet cannot be selected until it is included again.
- Selecting a planet immediately:
  - emphasizes the selected body and label;
  - draws a line from it to its currently nearest planet;
  - emphasizes the nearest planet without replacing the selection;
  - opens the selected-planet panel in the top-left corner.
- Selecting a different planet replaces the current selection.
- Pressing Escape or using a visible close control clears the selection.
- The connection line and nearest result update continuously as time plays, including in reverse.

### 6.3 Top-left selected-planet panel

The panel contains:

- a small recognizable icon of the selected planet;
- the selected planet's name;
- the current nearest planet's name and current physical center-to-center distance;
- the cumulative interval from Jan 1, 2000 through the displayed instant;
- a list of all other included planets and their current cumulative nearest-duration percentages;
- each listed planet's name, small icon, percentage, and an accessible text equivalent;
- a control or tooltip explaining the scientific and percentage methodology;
- a close control.

The small panel icons are identification artwork and may be normalized for legibility; the proportional-diameter rule applies to bodies in the orbital scene.

### 6.4 Labels and collision handling

- Every planet label uses the same font size, weight, padding, and contrast treatment.
- A leader line ending in an arrow points unambiguously from each label to the body's center.
- Labels may move to avoid collisions but must not detach visually from their leader arrows.
- Selected and nearest states must be conveyed by more than color alone.
- The Sun may have a label, but it does not participate in planet selection or statistics.

### 6.5 Time controls

The persistent time-control area contains:

- play/pause;
- forward/reverse direction;
- speed presets;
- a custom multiplier input;
- the current UTC date and time;
- a date/time jump control constrained to the supported range;
- a reset-to-start control.

Required presets are:

- real time (`1×`);
- one simulated day per real second;
- 30 simulated days per real second;
- one simulated year per real second;
- 10 simulated years per real second.

The custom control accepts a positive finite magnitude and expresses the effective signed multiplier after applying the forward/reverse direction. Invalid, zero, infinite, or out-of-range values must produce an inline validation message rather than silently changing the value. Pause is the supported zero-speed state.

Changing direction or speed must not change the displayed instant. Jumping to a date preserves the current direction and speed but leaves playback paused, preventing an immediate unexpected move away from the chosen date.

### 6.6 Navigation

- The scene supports mouse-wheel or trackpad zoom and drag-to-pan.
- A “fit system” control restores the default overview.
- Zoom and pan affect the scene transform, not scientific calculations.
- Labels remain readable during navigation and continue pointing to the correct bodies.

### 6.7 Planet inclusion controls

- The right-side planet rail provides a separate included/excluded control for every planet alongside its selection control.
- Excluded planets remain visible in the scene so the Solar System stays spatially complete, but their orbits, bodies, labels, and rail rows are visibly dimmed.
- Excluded planets cannot be selected, cannot receive the nearest-neighbor line, and make no contribution to cumulative nearest-duration percentages.
- Excluding the selected planet clears the selection. At least two planets must remain included.
- An “include all” action restores the default eight-planet candidate set.
- Inclusion changes take effect immediately without pausing or changing the displayed simulation time.

## 7. Layout and visual direction

- Desktop-first target: a minimum supported viewport of 1280 × 720 CSS pixels.
- The orbital scene occupies the main canvas.
- The selected-planet panel is anchored at the top left without covering the primary time controls.
- Time controls remain visible and stable, preferably centered along the bottom edge.
- The visual style should use a dark space background, restrained orbital paths, recognizable body colors, and high-contrast text.
- Orbits, labels, connection lines, and panels must remain distinguishable without relying solely on color.
- The current nearest line must be visually prominent but must not look like an orbital path.
- Avoid decorative stars or effects that reduce label or orbit readability.

## 8. Accessibility

- All controls and planet selections must be keyboard reachable.
- Provide visible focus indicators and logical focus order.
- Use semantic controls with accessible names, current values, and state announcements.
- Announce selection changes and nearest-planet changes through a polite live region without announcing every animation frame.
- Meet WCAG 2.2 AA contrast requirements for text and meaningful graphical objects.
- Honor reduced-motion preferences by defaulting to paused and suppressing nonessential animation effects; explicit playback remains available.
- Provide a text-accessible list of planets as an alternative selection method if the rendered bodies are too small to target.
- Planet body and label hit targets must be at least 24 × 24 CSS pixels even when the visible body is smaller; expanding a hit target must not enlarge the rendered body.

## 9. Persistence and URL behavior

- Persist the last valid date, direction, speed, camera view, selected planet, and included-planet set locally.
- Restored values must be validated and clamped to the fixed range.
- No account, server-side persistence, or user tracking is required.
- A future shareable URL is permitted but is not required for the initial release.

## 10. Performance and determinism

- Target smooth interaction at 60 frames per second on a contemporary desktop browser, with 30 frames per second as the minimum during the fastest playback.
- Playback must be based on elapsed time rather than frame count so simulation time is stable across refresh rates.
- Expensive long-range transition analysis must not run on the animation thread. A reproducibly precomputed distance-order timeline from the documented scientific model may be filtered for the included planets and queried at the displayed instant.
- The same model version, instant, and selected planet must produce the same position, nearest planet, and percentage values across supported browsers within documented numeric tolerance.
- Keep the model version and source metadata with generated percentage data so stale results cannot silently survive a model change.

## 11. Error and boundary states

- Invalid custom speeds and dates show inline, actionable errors.
- A date outside the supported range is rejected; it is not silently wrapped.
- Reaching a boundary pauses playback and visibly explains why.
- If transition data cannot load, orbital playback remains available and the panel shows a retryable statistics error rather than fabricated values.
- If the scientific model or source metadata is missing, the build must fail rather than falling back to random or hard-coded positions.

## 12. Suggested implementation architecture

This section guides later implementation but does not authorize coding.

- TypeScript, React, and Vite for a fully static GitHub Pages application.
- HTML Canvas for the animated orbital scene and connection line.
- A pure, separately testable astronomy module for positions, distances, and nearest-neighbor decisions.
- A build-time analysis path for deterministic nearest-transition generation.
- Versioned static data for orbital elements, source attribution, and the precomputed nearest-transition timeline.
- Accessible HTML controls and text content layered around the canvas; do not make the canvas the only interaction surface.
- Repository-relative asset paths and a GitHub Actions Pages workflow; no application server or Cloudflare runtime.

## 13. Acceptance criteria

The initial release is acceptable when all of the following are true:

1. Only the Sun and eight named planets appear as astronomical bodies.
2. The experience is a two-dimensional, top-down desktop web view.
3. Body diameter ratios match the documented physical mean diameters under one shared scale, including the Sun.
4. Orbital distances are visibly disclosed as compressed, and no screen-space distance is used for nearest calculations.
5. Every planet has an equal-style label and an arrow pointing to its position.
6. A user can select any planet from the scene or an accessible text list.
7. Selection opens the top-left name-and-icon panel and immediately draws one line to the physically nearest included planet.
8. The line and current-nearest text update continuously during forward and reverse playback.
9. The panel starts all other included planets at 0.0%, updates their cumulative nearest-duration percentages from January 1, 2000 through the displayed instant in real time, and sums to 100.0% whenever elapsed time is nonzero.
10. Play, pause, reverse, all required presets, a validated custom multiplier, date/time jump, and reset work at both boundaries.
11. Scientific calculations, percentage results, and visual transforms are deterministic and independently testable.
12. The model limitations, source, date range, distance compression, sampling, and rounding are disclosed in the interface.
13. Keyboard selection, focus, contrast, reduced-motion behavior, and text alternatives meet the accessibility requirements.
14. Automated tests cover orbital fixtures, range boundaries, nearest-neighbor decisions, percentage totals, tie behavior, controls, and core selection flows.
15. The planet rail can exclude and re-include planets; excluded planets are dimmed, cannot be selected or become nearest, and make no contribution to the recomputed cumulative percentages.

## 14. Explicitly deferred decisions

These details may be decided during a later design phase without changing the product's scientific behavior:

- exact color palette, typography, icon artwork, and decorative background;
- exact power or logarithmic function used for orbital-distance compression;
- precise responsive behavior below the desktop target;
- whether a shareable state URL is added after the initial release;

Any decision that changes the bodies, date range, dimensionality, relative-size rule, nearest definition, or percentage meaning requires an explicit specification revision before implementation.
