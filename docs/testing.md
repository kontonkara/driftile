# Testing

## Local checks

```bash
npm ci
npm run check
npm run package
nix flake check --all-systems --no-build
```

`npm run package:check` performs the slower release gate: it rebuilds the main
script, overview effect, helper, and manifest twice, compares exact bytes,
validates `SHA256SUMS`, and requires each KPackage's exact file list, plugin ID,
metadata version, content-addressed runtime directory, and disabled-by-default
policy. It recomputes each runtime address from exact QML and JavaScript bytes,
validates the cache-busted selector, and asks KPackage to install both archives
under temporary XDG roots. The main archive contract is checked independently
from the optional effect.
The flake check evaluates both modules for every supported architecture. It
also uses the pinned official Home Manager to verify standalone installation,
settings-only NixOS coexistence, generated profiles, independent main and
overview ownership, same-ID collision rejection, and disjoint physical package
outputs; the normal `nix flake check` builds the checks for the host.
To run only the deterministic budgets documented in
[Performance](performance.md), use `npm run performance:check`. The same tests
are already part of `check`.

## Isolated KWin smoke test

With Nix:

```bash
nix develop .#integration
npm ci
npm run test:integration
```

Use `npm run test:integration -- wayland`, `npm run test:integration -- wayland-multi-output`, or `npm run test:integration -- x11` to select a scenario. The Wayland selection runs separate single-output and two-output sessions.

Without Nix, install Bash, Node.js and npm, KWin 6.7 or newer for Wayland and X11, KGlobalAccelD, KScreen tools, LayerShellQt QML, XWayland, Xvfb, xterm, GJS with GTK 3 introspection data, `xrandr`, `xprop`, KPackage and KConfig tools, Qt QML tools with the Wayland and XCB platform plugins, D-Bus, `busctl` from systemd, `flock`, GNU `timeout`, and `jq`. Set `DRIFTILE_SMOKE_KGLOBALACCELD` to the `kglobalacceld` executable for X11. If LayerShellQt is outside Qt's standard import path, set `DRIFTILE_SMOKE_LAYER_SHELL_QML_IMPORT` to the directory containing `org/kde/layershell`. Then run the same npm command.

The test builds the exact versioned release assets, installs the `.kwinscript`
archive, and runs shortcut ownership through the checksummed companion helper.
It uses temporary user and XDG directories, private D-Bus sessions, virtual Wayland outputs, and an Xvfb display. Single-output sessions cover shortcut ownership, live gap changes with minimized-frame retention, existing-width preservation before explicit reset, live column-width and window-height steps with exact decrease and increase round trips, adjacent and edge column navigation, tiling and scrolling, stack reorder, horizontal extraction, direct insertion into a fully minimized target stack, explicit consume, and explicit expel past minimized passive peers, consume and expel edits, floating, 50-pixel manual-floating movement, exact manual-floating work-area centering, contextual manual-floating width and height decrease and increase, layer switching and geometric floating focus, minimized tiled-slot retention, focus skipping, no-wrap boundaries, transactional off-screen reveal, exact logical restoration, native fullscreen and maximize control, column sizing, available-width expansion, visible-group centering, per-window height adjustment, automatic reset, height presets, adjacent and numbered tiled or floating desktop transfers, whole-column desktop transfer past a minimized passive member, secondary desktop transfer with a settled minimized source-column peer retained without writes, numbered tail clamping, dynamic desktop cleanup, live hard-bound tightening and relaxation from Qt Quick and GTK 3 clients, KWin-owned window states, exact unload restoration, and native Wayland, XWayland, and native X11 clients. Real xterm windows in the XWayland and native X11 paths prove that character-cell resize increments are advertised. XWayland additionally proves exact off-lattice geometry; native X11 uses grid-aligned initial, resized, and reset frames to accommodate lattice enforcement. A runtime probe requires all four desktop-reorder actions to preserve identity, membership, geometry, focus, and the tail when KWin exposes the mechanism; otherwise it requires an exact state-preserving no-op. A two-output Wayland session also verifies one live gap change across both visible contexts, preserves different selected desktop IDs during reordering, then covers independent numbered desktop selection, context-local floating focus, application-driven stacked fullscreen for native Wayland and XWayland windows, native application-driven stacked maximize, XWayland shortcut-driven stacked maximize, whole-column and floating desktop transfers, whole-column output transfer past a minimized passive member, secondary output transfer with a settled minimized source-column peer retained without writes, focus preservation, exact geometry, capacity limits, full-client focus reachability after output removal and re-enable, topology recovery, and unload ownership.

The native Wayland, XWayland, and native X11 single-output passes require the
floating width and height actions to preserve focus, context, and all tiled
state while producing exact configured-step round trips. Together they exercise
immediate and delayed backend settlement. Unit coverage separately proves
reinsertion placement and exactly one forward frame request.

Once per KWin session, the settled application layout also enables and disables
both touchpad navigation modes through KConfig without reloading the script. Both changes
must preserve every frame, focus, desktop, persisted layout byte, and the full
KGlobalAccel action list. Two enable cycles must create and destroy exactly two
horizontal and two vertical handler generations without QML diagnostics; native
X11 exercises the same path as a safe no-op.
Native Wayland and X11 single-output fixtures also reload the installed script twice, requiring byte-identical canonical state and stable minimized stack slots. X11 keeps transient minimized frame coordinates under KWin ownership while decorations are released and reclaimed, then requires exact layout geometry after restoration. Native two-output Wayland additionally preserves output-local manual floating ownership.

Before layout scenarios start, every isolated backend imports the packaged state-store component through a declarative probe. Three load and unload generations require exact escaped Unicode JSON with its trailing newline, destruction-time flush before the long debounce timer, duplicate cancellation, unchanged committed state, and a separate timer-driven commit. The file lives only in that backend's temporary XDG configuration directory.

The unit suite also validates canonical persistence encoding, stable runtime
capture, changed-state publication, callback-failure retry, strict schema limits, reference ownership, floating-anchor
normalization, fail-closed decoding of corrupt or future state, exact live-ID
precedence, globally unique session descriptors, ambiguous-match rejection,
output serial and connector policies, deterministic ordering, and the maximum
persisted window count without pairwise scanning. Catalog coverage verifies
bare and nested v1 and v3 migration to canonical v4 logical state inside strict
v2 catalogs, complete topologies with empty outputs, serial-aware MRU
deduplication, active-only restore baselines, callback
failure rollback, four-entry and 4 MiB eviction, and full-topology startup
selection. Known-output planning covers global identity uniqueness, connector
renames, exact target-window ownership, and fail-closed baseline and floating
state rejection. Runtime coverage exercises output-atomic restoration and
geometry-rejection fallback while unchanged outputs retain their layout and
focus, plus one publication for each settled topology-only empty-output change.
Hydration planning covers
exact-ID precedence, complete cross-session descriptor remapping, ambiguity and
weak-identity rejection, stale baseline removal, context guards, immutable
`LayoutEngine`-compatible plans, floating-anchor remapping, and the 4096-window
limit in linear passes. Runtime coverage verifies atomic immediate and delayed
startup application, pre-commit identity validation, cross-session stack
restoration with current-session baselines, ambiguous-match fallback without
partial ownership, bounded late-window success and timeout, quiet-candidate
sampling, retry cancellation, topology-barrier fallback, minimized and hidden
write suppression, extra-window
admission, full-width outer-gap placement, adjacent-frame clearance of at least
one physically aligned configured gap beyond each viewport edge, zero-gap
no-clearance, current-viewport retention during width restoration,
stale-state preservation,
context-guarded
original restore baselines across repeated reloads, manual-floating
current-context capture with source-exact rollback, and permanent future-version
or oversized-document write locking.

Overview coverage validates current-snapshot selection, exact live topology,
desktop and window matching, bare-v1 rejection, baseline stripping, immutable
projection, input-order independence, the 4,096-window operation budget, the
two-read store boundary, public-only KWin imports, the direct live window
reference, unchanged current-card focus, every live focus guard, fail-closed
invalid input, accepted-focus confirmation, non-current number-gutter target,
and cross-desktop thumbnail activation. Cross-desktop coverage requires exact
effect, model, screen, projected output, desktop, window, and activity guards;
allows off-desktop hidden state only before selection; confirms the public
selection path; then revalidates visible state and confirms exact focus. It also
covers pre-selection no-ops and post-selection late failures that close the
stale effect without desktop rollback. The only permitted KWin writes or
requests are `KWin.Workspace.activeWindow`, `KWin.SceneView.currentDesktop`, the
guarded `KWin.Workspace.currentDesktop` fallback, and one guarded public
`KWin.Workspace.moveDesktop` call for a validated card reorder. Settings,
shortcut-assignment, screen-edge, window-move, geometry, and membership writes
remain forbidden; actions, bindings, schema, private APIs, and timers remain
absent. Window, stacking-order, and layout scans remain forbidden.

The two-output Wayland scenario routes a physical left click through the
compositor for native Wayland and XWayland passes. It verifies both exact
current-card focus and per-output desktop selection, then cross-desktop
thumbnail activation against an exact target plus the last-active decoy. The
other output, frames, memberships, settings, persisted layout, and Plasma's
built-in Overview must remain unchanged. Native X11 retains static fallback and
toggle-only lifecycle coverage without claiming end-to-end selection or
cross-desktop activation.

The 1.20.0 test slice is proportional to its behavior. Core and settings cases
cover the global initial `stacked` or `tabbed` presentation, exact application
overrides, unchanged existing and restored columns, and durable tabbed
singletons across structural operations. Overview cases cover ordered tab
selection and visible, disabled minimized members. Indicator coverage requires
confirmed tab changes, bounded text, and suppression while either overview is
active. Shortcut coverage assigns `Meta+O` only to a fresh overview action and
preserves every existing assignment. Existing backend and VM scenarios cover
the packaged behavior without adding a new test pool or private API.

The 1.21.0 release slice remains effect-only. Focused core tests cover active
and fallback selection, deterministic spatial movement without wrapping, and
invalid or missing targets. QML checks cover thumbnail and tab identity,
minimized and fully clipped exclusions, visible clipping bounds, guarded
activation keys, and `Escape`.

Build, package, and exact-SHA CI cover the stable artifacts. One hidden full
Wayland VM checkpoint routes physical keyboard input through the packaged
effect; no new application or backend matrix is added.

The 1.22.0 release slice remains effect-only. A focused pure matrix covers
every insertion slot, protected-tail boundary, no-op, and invalid numeric
input. QML checks require a plain left number-gutter drag, fixed cards with one
insertion marker, exact grab and release revalidation, one public reorder call,
constant-time pointer updates, and write-free cancellation or stale state.

The existing hidden full Wayland VM checkpoint adds one physical gutter drag
with Konsole, Firefox, XWayland xterm, and Calculator. It verifies the exact
desktop order, IDs, protected tail, selection, focus, memberships, frames,
layout state, cleanup, and overview reopen without adding an application or
backend matrix.

The 1.23.0 release slice remains presentation-only. A focused overview contract
check and QML lint cover badge label grammar, bottom placement, fail-closed
visibility, visible-span clipping, pass-through input, and constant-time column
and delegate lookup. The hidden lifecycle VM verifies installation of the
published 1.22.0 packages and upgrade to matching 1.23.0 packages. Packaging and
exact-SHA CI cover the stable artifacts; this slice adds no full feature VM,
backend, or application matrix.

The 1.24.0 release slice remains effect-only. One focused QML contract test
covers current-attempt identity, rejection-only ordering, one best-effort OSD
request, internal reason logging, and silent cancellation, stale, success, and
normal-close paths. QML lint and the package check cover the effect source and
release archive. The hidden lifecycle baseline installs public 1.23.0 packages
and upgrades them to matching 1.24.0 packages; it validates packaging
lifecycle, not rejection feedback. Exact-SHA CI remains required before the
release tag. This slice makes no feature-VM coverage claim and adds no backend
or application matrix.

The 1.25.0 release slice reuses the existing output-transfer fixtures and
multi-output checkpoint. Focused runtime cases cover one manual and one
automatic relation-free floating target, destination-desktop adoption,
unchanged tiled contexts, zero frame writes, missing-API and relationship
rejection, and bounded output, membership, and focus compensation. Package and
Nix evaluation and build gates pass. A headless real-KWin Wayland multi-output
run covers the contextual transfer and reverse path. A hidden two-head VM
confirms the packaged multi-output baseline. A hidden lifecycle VM upgrades
public 1.24.0 packages to matching 1.25.0 packages, exercises real applications,
and removes both packages. Exact feature SHA `918eeb0` passes CI quality,
native X11, and Wayland jobs. The slice adds no application or backend matrix.

The 1.26.0 release slice adds one focused runtime case for numbered
single-window extraction, retained source state, source-width inheritance, tail
clamping, and a same-target no-op. Existing shortcut and QML contracts cover all
nine unbound action IDs while requiring the default 88-action helper profile to
remain byte-identical. The established packaged desktop-transfer coverage is
reused without a new integration, application, backend, or feature-VM scenario.
Package, Nix evaluation, and Nix build gates pass. Exact feature SHA `aa17fe3`
passes CI quality, native X11, and Wayland jobs. A hidden lifecycle VM upgrades
public 1.25.0 packages to matching 1.26.0 packages, exercises Konsole and KDE
Calculator, removes both packages, and confirms that KWin remains usable.

The 1.27.0 release slice uses focused runtime coverage for contextual
manual-floating preset cycling and reset, including configured percentages,
singleton pixel resolution, constraints, reachability, exact acknowledgement,
and fail-closed automatic, related, blocked, and pending targets. Exact feature
SHA `4bac7ea` passes CI quality in 2:36, native X11 in 3:07, and Wayland in 6:31.
Existing packaged width settlement and tiled preset/reset coverage is reused
without a new backend, integration, application, or VM matrix. This release
makes no VM validation claim.

The 1.28.0 release slice uses focused runtime coverage for contextual
manual-floating direct insertion. It covers both directions, singleton
skipping, target width and presentation adoption, automatic height, retained
focus, ownership transfer, related-window rejection, state-round-trip
compensation, and no-target rejection without tiled fallback. Exact feature
SHA `9a5d0ab` passes CI quality in 2:41, native X11 in 3:02, and Wayland in
7:12. Existing shortcut registration and tiled direct-insertion coverage is
reused without a new integration, application, backend, or VM matrix. This
release makes no VM validation claim.

The 1.29.0 release slice adds focused decoder, settings-transport, and runtime
coverage for `WindowHeightPresets`. It verifies the blank exact
`1/3`, `1/2`, and `2/3` fallback, 1–16 strictly increasing integer percentages
from 10 through 100, live replacement without geometry, layout, frame,
viewport, focus, or persistence writes, stable semantic codes that prevent
reinterpretation of existing tiled preset selection, and later tiled use of the
replacement cycle.
Manual-floating cases cover forward and reverse wrapping, gap-adjusted
assigned-output pixel-grid resolution, preserved width, focus, context,
reinsertion anchor, and tiled layouts, one immediate frame request, and related
or pending fail-closed targets. Existing shared manual-floating size coverage
supplies decorated constraints, partial reachability, delayed exact
acknowledgement, repeated-command serialization, cleanup, exact metadata
commits, and stale-result rejection.

Shortcut contracts verify `Meta+R` for forward width, `Meta+Shift+R` for
forward height, unbound reverse actions, unchanged action IDs, and preservation
of existing KGlobalAccel assignments. The helper's default profile changes with
that mapping; release migration accounts for the previous helper-owned profile.
The combined feature batch at `b858c00` and `9093c12` passes the grouped local
formatting, type, lint, unit, package, Nix evaluation, and Nix build gates. Exact
SHA `9093c121a33b3ec72fce6602267cf29b88423192` passes CI run `29419108286`.
One hidden full Wayland VM checkpoint at the same SHA retains the existing mixed
application pool, invokes reverse width cycling directly by action ID, and
routes physical `Meta+Shift+R` through forward height cycling. No visible VM was
run for this slice.

In the following unit list, zero writes to floating windows means ambient
layout work; explicit manual-floating movement, centering, or contextual size
resizing owns its guarded frame request.

The unit suite also covers shortcut manifests, live gap bounds, coalescing, exact reflow, hidden-context deferral, and zero writes to minimized or floating windows, default-width bounds, existing-layout preservation, deferred application, constrained waiting admission, newly admitted columns, and reset, resize-step bounds, no-write live changes, exact percentage-point actions, stack redistribution, decorated constraints, physical-pixel clamps, and rollback, unusable singleton, grouped, delayed-startup, and managed-context recovery with healthy-context isolation, a 128-cycle window lifecycle with synchronous geometry acknowledgements and bounded scheduler settlement, one-step desktop-reorder permutations, boundaries, rejection paths, and pinned-tail preservation, numbered desktop validation and tail clamping, immutable whole-column previews, floating transfer isolation and relationship guards, whole-column minimized-passive desktop and output transfer, secondary transfer with retained same-column minimized peers, zero mechanism and geometry writes, cancellation and rollback races, fail-closed minimized windows outside the source column or in the target context for default whole-column and secondary single-window transfers, batch transfer commits and rollback, trailing-desktop ownership, stack mutations and rollback, weighted window heights, deterministic output routing, floating ownership, guarded directional movement, partial-visibility bounds, exact work-area centering, layer focus memory and geometric navigation, minimized tiled-slot and manual-floating-frame retention, minimized focus skipping, vertical reorder, horizontal extraction, direct insertion across minimized source and target peers, fully minimized targets, skipped-singleton nonparticipation, authoritative hidden-frame changes, state-round-trip rollback, fail-closed state blockers, explicit consume, and explicit expel across minimized passive slots, no-wrap boundaries, transactional tiled-layer reveal, synchronous and deferred focus confirmation, reentrant focus rejection and rollback, fail-closed non-minimize suspension blockers, all-member transaction guards, projected stack rollback across authoritative removals, stacked fullscreen and maximize extraction past settled minimized peers, exact compensation, optional borderless ownership, reclassification, decorated frame constraints, topology-stable resize and reset clamps, cached silent hard-bound changes, test-only advisory increment and aspect metadata, available-width expansion, exact signed-offset centering, column and window sizing rollback, rotation bursts, rapid same-name output replacement, topology barriers, capacity recovery, and stale callback cancellation.

Manual-floating size coverage verifies configured gap-free work-area width and
height steps, width presets and global-default reset through exact singleton
resolution, decorated live bounds, positive client extents, pixel-grid snapping,
preservation of the other dimension, partial visibility, and one forward
request. It covers immediate and delayed exact acknowledgement, repeated-command
serialization, cleanup, exact metadata commits, nonexact and stale rejection,
fail-closed ineligible targets, and zero tiled mutation. Window-height reset
remains on the tiled path. The 1.29.0 criteria add only the contextual
manual-floating forward and reverse preset cases, configurable cycle coverage,
and shortcut contracts described above.

Application-width coverage verifies the bounded one-entry-per-line decoder,
10%–100% values, the 128-entry limit, duplicate and malformed rejection, exact
case-sensitive `desktopFileName` lookup, constant-time admission, global-default
fallback, existing-column preservation, waiting admission, and live constraint
clamping for new singleton columns. Nix module checks verify the canonical
KConfig encoding from typed Home Manager profiles.

Application-exclusion coverage verifies bounded exact-ID decoding, canonical
Home Manager encoding, atomic seventeen-setting updates, startup exclusion, live
release and fresh readmission, native-state blockers, persistence omission,
constant-time membership checks, and zero writes to excluded frames.

Initial-floating coverage reuses the bounded exact-ID decoder and verifies
fresh manual-floating admission, an unchanged pre-existing window, and normal
toggle-back reinsertion. Existing settings transport, automatic-floating,
hydration, persistence, and manual-floating checks cover the shared mechanics
without adding a duplicate VM scenario.

`ApplicationBorderlessExclusions` coverage verifies the 65,664-character
document, 512-character raw-line, 128-entry, and 255-byte ID limits; blank-line
handling; canonical sorting; and atomic rejection of duplicates, controls,
invalid UTF-16, and oversized input. Runtime cases cover exact case-sensitive
`desktopFileName` matching without fallbacks, missing and empty IDs, tiled,
floating, dialog, transient, and utility windows, global-disable dominance,
live policy and identity changes, pre-existing borderless state, and
add or remove paths without geometry writes, focus changes, or layout-state or
layout-persistence changes. Global-disable and unload cases verify
ownership-safe restoration separately. Nix checks pin the seventeen-field option
surface and sorted Home Manager KConfig encoding.

Pointer coverage includes strict visible-target planning, midpoint selection,
same-stack height retention, cross-column automatic height, destination-width
inheritance, and exact same-context rollback. Cross-output cases cover both
KWin signal orders, before-and-after insertion, source cleanup, retained
destination width, automatic moved height, partial-frame compensation, no
output or desktop mechanism writes, and ordinary singleton admission for
empty, stale, ambiguous, or raced targets.

The 1.30.0 release adds focused unit coverage for empty horizontal
gutters before, between, and after visible columns; clipped previews; malformed
or incomplete geometry; and ineffective adjacent singleton targets. Core cases
cover distant whole-column preservation, stack-member extraction before or
after its own or another column, passive order, height and selection retention,
automatic moved height, collision rejection, and exact rollback. Existing
exact-window and cross-context cases remain unchanged.

Exact feature SHA `3985dd9562493b4808c3086159a6b191a6506ee1` passes the grouped
local check across 36 files and 1,558 tests, the reproducible package check,
all-system Nix evaluation, and the native Nix build. CI run `29424914946`
passes quality, native X11, and Wayland. One hidden full Wayland VM at the same
SHA passes the existing mixed Konsole, Firefox, KCalc, and XWayland pool plus
the physical pointer and shortcut baseline. It did not physically exercise the
new gutter target, and no visible VM was run.

The 1.31.0 release adds destination-only gutter planning for
before, between, and after boundaries; one atomic cross-context stack-member
transfer into a fresh singleton; and focused runtime cases for cross-output,
cross-desktop, and invalidated-boundary fallback. Exact-window priority and the
existing signal-order matrix remain covered by their prior cases. The slice
adds no backend, application, integration, or VM scenario.

The same package adds focused cases for right full-width successor visibility,
focus recovery after active-window removal, the 33% missing-setting default,
top and bottom stacked-window resize adoption, and exact-window or empty-gutter
tiling of a manually floating window. These paths reuse the existing grouped
integration and VM baselines instead of adding another matrix.

Activity-focused cases isolate identical output and desktop IDs across two
activities, retain each layout across switching, rehome a window after an exact
membership change, and reject all-activity, multi-activity, stale, or malformed
ownership when multiple activities exist. Persistence cases cover v1 and v3
migration to v4, removed-activity rejection, and activity-qualified floating
placements. Overview cases project only the current activity and close on
current-activity or activity-set changes.
The existing full Wayland VM adds one bounded activity scenario with native
Firefox and XWayland xterm. It assigns exact memberships, changes width and
column order only in the secondary activity, verifies primary isolation and
secondary restoration, then removes the temporary activity.

Cross-desktop unit cases cover the 2x2 matrix of output-local or global desktop
resolution and membership-before-finish or finish-before-membership event
order. They verify bounded pending-destination settlement, fallback when the
target is initially unavailable or becomes invalidated, unrelated-context
isolation, zero hidden-source writes, and exact destination compensation before
singleton admission.

The 1.6 slice adds focused horizontal pointer-resize coverage.
`WindowObserver` cases cover direct and fallback start and finish delivery,
duplicate suppression, and cloned initial and final frames. Pure planner cases
classify left-, right-, corner-, vertical-, and ambiguous-edge changes. Runtime
cases keep the logical layout unchanged until every same-context target matches
for two samples, cover delayed Wayland-style configure delivery and the
mutation barrier, and require one publication on success. Timeout coverage
delivers a late forward configure after rollback starts and verifies the
20-sample rollback quiet period within the 40-probe recovery bound. Additional
cases verify focus replay, native-state lease protection, partial-write
compensation, fail-closed races, and `O(V)` context-local work.

Packaged single-output checks drive the same finish-only adoption and reset path
for native Wayland and XWayland windows through the Wayland fake-input protocol,
and for native X11 through XTEST. The visible full VM checkpoint passed on
2026-07-13 with native Wayland Firefox and XWayland xterm. A physical `Meta`
plus right-button resize proved KWin's held interactive state before release,
then verified accepted-width adoption and an exact stacked-frame reset. No
unrelated scenario or test-pool expansion belongs to this slice.

The isolated two-output Wayland scenario uses KScreen to verify scale and
position changes, exact known-output history restoration over a deliberately
different reduced right-side stack for native Wayland and XWayland windows,
unchanged remaining ownership and focus, and six-client reachability after
output disable and re-enable. A native layer-shell panel verifies work-area
recovery.

The isolated X11 scenario verifies a grid-aligned real xterm resize and reset cycle, shortcut-driven stacked fullscreen and maximize extraction, live RandR mode changes, and work-area recovery from a real EWMH dock strut. It also uses XTEST to hold a real `Meta+left` edge drag across a KWin-owned desktop switch, releases over a real xterm target, and verifies exact insertion frames, retained target state, active focus, unchanged hidden source state, and cleanup.

The isolated backend tests do not cover application-driven live hard-bound changes outside Qt Quick and GTK 3, native X11 tiled requests outside an advertised resize lattice, unexposed aspect-hint enforcement, Plasma's own panels, real GPUs, physical keyboard input, physical connector hot-plugging, or native X11 multi-output layouts.

Set `DRIFTILE_KEEP_SMOKE_SANDBOX=1` to retain the temporary files after a run.

## Plasma VM

On NixOS, run the VM from a graphical session with KVM available:

```bash
tools/vm/run.sh
```

Add `--hidden` to any VM command to keep QEMU off-screen. Hidden mode retains
the virtual display and QMP input path, skips host window sizing, requires no
graphical host session, and still shuts down immediately after the checkpoint:

```bash
tools/vm/run.sh lifecycle --hidden
```

For the focused two-output pointer checkpoint, run:

```bash
tools/vm/run.sh two-head
```

This separate mode opens two non-fullscreen `688x768` SDL scanouts, verifies
native Wayland Firefox and XWayland xterm, injects physical cross-output drags,
checks targeted insertion and empty-output fallback, then closes immediately.

For the focused release migration checkpoint, run:

```bash
tools/vm/run.sh lifecycle
```

The lifecycle mode opens one non-fullscreen `1366x768` Wayland VM with no
preinstalled Driftile package. It installs the pinned published stable script
and overview archives, keeps the overview disabled, then loads it once to
confirm that a fresh action receives `Meta+O` and retains that assignment after
unload. It unloads the script and upgrades both packages to the current build.
The checkpoint verifies package identities, runtime digests, the default-off
touchpad setting, effect discovery, and preservation of the published overview
assignment through upgrade, current load, and current unload. The upgraded
script must also register the current close-window action after reloading the
stable fixed bootstrap. Its nonce-scoped selector resolves the new
content-addressed runtime inside the shared KWin QML engine. The full VM
independently loads the same bootstrap in a fresh session. Finally, the
lifecycle VM exercises Konsole and KDE Calculator, removes both packages, and
confirms that KWin remains operational.

The script builds `nixosConfigurations.driftile-vm` through `nixos-rebuild build-vm` and asks host KWin for a centered `1440x900` QEMU window with a `1680x1050` guest display. The guest receives 8 virtual CPUs and 8 GiB of memory. Plasma starts a Wayland session, enables Driftile, claims its shortcut profile, and runs the acceptance pool. Separate Konsole processes provide a stable baseline, while the primary structural workflow uses offline Firefox for direct insertion and as a passive peer during stacked maximize, XWayland xterm for minimized-edge navigation, KDE Calculator as a numbered-desktop destination, and fixed-size XWayland `xmessage` for automatic-floating constraints. A final lifecycle pool repeats Firefox, KDE Calculator, and xterm checks after all physical shortcut scenarios. The VM requires borderless state for tiled, fixed-size, manually floating, and application windows. It focuses, minimizes, restores, resizes, and closes real applications while checking their slots, neighboring frames, and exact layout reflow. The desktop workflow also transfers a visible active Konsole while a settled minimized source-column peer retains its slot, state, and frame without writes. `kdotool` reads the active KWin window during these checks.

The primary VM also applies a 60% Firefox rule, confirms that changing it to
80% leaves the existing column untouched, and verifies the wider rule on a new
Firefox window.

It then combines an 80% Firefox rule with an exact tiling exclusion. The
excluded window and three-column baseline remain unchanged under tiling
commands; clearing the exclusion admits Firefox at the configured width; live
re-exclusion restores the exact sibling layout while preserving Firefox's tiled
frame. Unit tests separately verify that exclusion transitions issue no frame
writes to the excluded window.

The same VM applies exact application borderless exclusions to native Konsole
and XWayland xterm while KDE Calculator remains under the global borderless
policy. Clearing and reapplying the list changes only owned decorations and
preserves the active window and baseline layout. Packaged integration repeats
live add, remove, global-disable, re-enable, and unload checks for native
Wayland, XWayland, and single-output native X11 windows.

It also toggles focused-column centering live against the three Konsole
columns. The disabled path preserves the exact minimal-reveal frames, while
the enabled path preserves order and dimensions, translates every column by
the same nonzero offset, and centers the focused column within one physical
pixel before the disabled baseline is restored.

The same VM applies the custom column-width preset list `25,75` to an active
Konsole column. Physical `Meta+R` input selects 75%, wraps forward to 25%, and
physical `Meta+Shift+R` wraps back to 75% through the reverse-width action.
Each frame is checked against the gap-adjusted output proportion before the
setting is cleared and the exact baseline layout is restored.

The existing stacked Konsole scenario then applies the custom window-height
preset list `25,75`. Physical `Meta+Ctrl+Shift+R` selects the 75% target through
the forward-height action. Physical `Meta+Ctrl+R` restores automatic heights
before the temporary preset list is cleared, and the exact stack remains
unchanged by configuration cleanup. The existing backend and application
matrix is reused.

At the settled Firefox, Konsole, and XWayland xterm pointer layout, the primary
VM first verifies that both touchpad modes default to disabled, then applies
`true`, `false`, `true`, and `false` to both live through KConfig. Every transition
preserves exact frames, focus, desktop order and selection, persisted layout
bytes, the full KGlobalAccel action list, the loaded core extension, and the
built-in Overview state. The journal must report exactly two horizontal and two
vertical handler creations and destructions without component diagnostics, and
cleanup restores `false`.

At the same settled pointer layout, the primary VM confirms that the separately
installed overview effect is disabled and registers `Meta+O`. It loads the
effect through KWin, opens it with physical `Meta+O`, and uses physical
`Enter` to activate the initial XWayland target. A second pass uses physical
`Up` and `Enter` to activate Firefox; a third confirms that physical `Escape`
closes without changing the active application. The checkpoint rejects
component errors and preserves frames, desktops, persisted layout bytes, and
Plasma's built-in Overview. After unloading the effect, the retained action is
invoked once more to prove it is inert while the main extension remains
loaded. The stable 1.22.0 release runs this expanded full checkpoint hidden.

The host injects real keyboard shortcuts and absolute `Meta+left` drags through QEMU QMP, so Plasma routing and pointer behavior cannot hide behind direct invocation. The pointer checkpoint moves native Wayland Firefox into an XWayland xterm column, verifies destination width and order, then reorders the resulting stack. A second physical drag moves native Wayland Firefox through a KWin-owned same-output desktop switch, releases it over a fresh XWayland target, and verifies destination order and width, active focus, unchanged hidden primary-desktop frames, and exact cleanup. The VM also verifies both desktop-reorder directions and aliases against real applications while preserving desktop IDs, selection, window memberships, focus, frames, and the shared tail. It applies and restores a live gap while a real Konsole window is floating. For default width and both resize steps, it co-delivers each policy with a temporary gap barrier, restores the gap, then proves exact existing frames before the explicit action. The remaining checks cover dynamic desktops, minimized-slot navigation, column reorder, horizontal extraction, explicit consume and expel past minimized peers, tiled and floating transfers, transfer boundaries, layer navigation, stack editing, fullscreen and maximize, sizing, and viewport scrolling with native Wayland and XWayland clients. The real xterm path also verifies advertised character-cell resize increments and exact off-lattice tiled geometry. See [Shortcuts](shortcuts.md).

The VM is ephemeral, has restricted networking, and cannot be switched onto the host. The passwordless `driftile` account signs in automatically. Screen locking, display power saving, and system sleep are disabled inside the guest. The launcher closes the VM immediately after the checks report success or failure. The X11 Plasma session remains available from the login screen; automated integration tests cover both KWin backends.
