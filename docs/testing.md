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
metadata version, and disabled-by-default policy. The main archive contract is
checked independently from the optional effect.
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
It uses temporary user and XDG directories, private D-Bus sessions, virtual Wayland outputs, and an Xvfb display. Single-output sessions cover shortcut ownership, live gap changes with minimized-frame retention, existing-width preservation before explicit reset, live column-width and window-height steps with exact decrease and increase round trips, adjacent and edge column navigation, tiling and scrolling, stack reorder, horizontal extraction, direct insertion into a fully minimized target stack, explicit consume, and explicit expel past minimized passive peers, consume and expel edits, floating, layer switching and geometric floating focus, minimized tiled-slot retention, focus skipping, no-wrap boundaries, transactional off-screen reveal, exact logical restoration, native fullscreen and maximize control, column sizing, available-width expansion, visible-group centering, per-window height adjustment, automatic reset, height presets, adjacent and numbered tiled or floating desktop transfers, whole-column desktop transfer past a minimized passive member, secondary desktop transfer with a settled minimized source-column peer retained without writes, numbered tail clamping, dynamic desktop cleanup, live hard-bound tightening and relaxation from Qt Quick and GTK 3 clients, KWin-owned window states, exact unload restoration, and native Wayland, XWayland, and native X11 clients. Real xterm windows in the XWayland and native X11 paths prove that character-cell resize increments are advertised. XWayland additionally proves exact off-lattice geometry; native X11 uses grid-aligned initial, resized, and reset frames to accommodate lattice enforcement. A runtime probe requires all four desktop-reorder actions to preserve identity, membership, geometry, focus, and the tail when KWin exposes the mechanism; otherwise it requires an exact state-preserving no-op. A two-output Wayland session also verifies one live gap change across both visible contexts, preserves different selected desktop IDs during reordering, then covers independent numbered desktop selection, context-local floating focus, application-driven stacked fullscreen for native Wayland and XWayland windows, native application-driven stacked maximize, XWayland shortcut-driven stacked maximize, whole-column and floating desktop transfers, whole-column output transfer past a minimized passive member, secondary output transfer with a settled minimized source-column peer retained without writes, focus preservation, exact geometry, capacity limits, full-client focus reachability after output removal and re-enable, topology recovery, and unload ownership.
Native Wayland and X11 single-output fixtures also reload the installed script twice, requiring byte-identical canonical state and stable minimized stack slots. X11 keeps transient minimized frame coordinates under KWin ownership while decorations are released and reclaimed, then requires exact layout geometry after restoration. Native two-output Wayland additionally preserves output-local manual floating ownership.

Before layout scenarios start, every isolated backend imports the packaged state-store component through a declarative probe. Three load and unload generations require exact escaped Unicode JSON with its trailing newline, destruction-time flush before the long debounce timer, duplicate cancellation, unchanged committed state, and a separate timer-driven commit. The file lives only in that backend's temporary XDG configuration directory.

The unit suite also validates canonical persistence encoding, stable runtime
capture, changed-state publication, callback-failure retry, strict schema limits, reference ownership, floating-anchor
normalization, fail-closed decoding of corrupt or future state, exact live-ID
precedence, globally unique session descriptors, ambiguous-match rejection,
output serial and connector policies, deterministic ordering, and the maximum
persisted window count without pairwise scanning. Catalog coverage verifies
bare-v1 migration, strict canonical v2 snapshots, complete topologies with empty
outputs, serial-aware MRU deduplication, active-only restore baselines, callback
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
admission, full-width restoration, stale-state preservation, context-guarded
original restore baselines across repeated reloads, manual-floating
current-context capture with source-exact rollback, and permanent future-version
or oversized-document write locking.

Overview coverage validates current-snapshot selection, exact live topology,
desktop and window matching, bare-v1 rejection, baseline stripping, immutable
projection, input-order independence, the 4,096-window operation budget, the
two-read store boundary, public-only KWin imports, and the absence of settings,
workspace, shortcut-assignment, or screen-edge writes.

The unit suite also covers shortcut manifests, live gap bounds, coalescing, exact reflow, hidden-context deferral, and zero writes to minimized or floating windows, default-width bounds, existing-layout preservation, deferred application, constrained waiting admission, newly admitted columns, and reset, resize-step bounds, no-write live changes, exact percentage-point actions, stack redistribution, decorated constraints, physical-pixel clamps, and rollback, unusable singleton, grouped, delayed-startup, and managed-context recovery with healthy-context isolation, a 128-cycle window lifecycle with synchronous geometry acknowledgements and bounded scheduler settlement, one-step desktop-reorder permutations, boundaries, rejection paths, and pinned-tail preservation, numbered desktop validation and tail clamping, immutable whole-column previews, floating transfer isolation and relationship guards, whole-column minimized-passive desktop and output transfer, secondary transfer with retained same-column minimized peers, zero mechanism and geometry writes, cancellation and rollback races, fail-closed minimized windows outside the source column or in the target context for default whole-column and secondary single-window transfers, batch transfer commits and rollback, trailing-desktop ownership, stack mutations and rollback, weighted window heights, deterministic output routing, floating ownership, layer focus memory and geometric navigation, minimized tiled-slot and manual-floating-frame retention, minimized focus skipping, vertical reorder, horizontal extraction, direct insertion across minimized source and target peers, fully minimized targets, skipped-singleton nonparticipation, authoritative hidden-frame changes, state-round-trip rollback, fail-closed state blockers, explicit consume, and explicit expel across minimized passive slots, no-wrap boundaries, transactional tiled-layer reveal, synchronous and deferred focus confirmation, reentrant focus rejection and rollback, fail-closed non-minimize suspension blockers, all-member transaction guards, projected stack rollback across authoritative removals, stacked fullscreen and maximize extraction past settled minimized peers, exact compensation, optional borderless ownership, reclassification, decorated frame constraints, topology-stable resize and reset clamps, cached silent hard-bound changes, test-only advisory increment and aspect metadata, available-width expansion, exact signed-offset centering, column and window sizing rollback, rotation bursts, rapid same-name output replacement, topology barriers, capacity recovery, and stale callback cancellation.

Application-width coverage verifies the bounded one-entry-per-line decoder,
10%–100% values, the 128-entry limit, duplicate and malformed rejection, exact
case-sensitive `desktopFileName` lookup, constant-time admission, global-default
fallback, existing-column preservation, waiting admission, and live constraint
clamping for new singleton columns. Nix module checks verify the canonical
KConfig encoding from typed Home Manager profiles.

Application-exclusion coverage verifies bounded exact-ID decoding, canonical
Home Manager encoding, atomic nine-setting updates, startup exclusion, live
release and fresh readmission, native-state blockers, persistence omission,
constant-time membership checks, and zero writes to excluded frames.

Pointer coverage includes strict visible-target planning, midpoint selection,
same-stack height retention, cross-column automatic height, destination-width
inheritance, and exact same-context rollback. Cross-output cases cover both
KWin signal orders, before-and-after insertion, source cleanup, retained
destination width, automatic moved height, partial-frame compensation, no
output or desktop mechanism writes, and ordinary singleton admission for
empty, stale, ambiguous, or raced targets.

The isolated two-output Wayland scenario uses KScreen to verify scale and
position changes, exact known-output history restoration over a deliberately
different reduced right-side stack for native Wayland and XWayland windows,
unchanged remaining ownership and focus, and six-client reachability after
output disable and re-enable. A native layer-shell panel verifies work-area
recovery.

The isolated X11 scenario verifies a grid-aligned real xterm resize and reset cycle, shortcut-driven stacked fullscreen and maximize extraction, live RandR mode changes, and work-area recovery from a real EWMH dock strut.

The isolated backend tests do not cover application-driven live hard-bound changes outside Qt Quick and GTK 3, native X11 tiled requests outside an advertised resize lattice, unexposed aspect-hint enforcement, Plasma's own panels, real GPUs, physical keyboard input, physical connector hot-plugging, or native X11 multi-output layouts.

Set `DRIFTILE_KEEP_SMOKE_SANDBOX=1` to retain the temporary files after a run.

## Visible Plasma VM

On NixOS, run the VM from a graphical session with KVM available:

```bash
tools/vm/run.sh
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
preinstalled Driftile package. It installs and loads the pinned 1.2.0 release,
unloads and upgrades it to the current package, opens and closes Konsole and
KDE Calculator, removes the package, verifies KWin with another Calculator
window, then closes immediately.

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

It also toggles focused-column centering live against the three Konsole
columns. The disabled path preserves the exact minimal-reveal frames, while
the enabled path preserves order and dimensions, translates every column by
the same nonzero offset, and centers the focused column within one physical
pixel before the disabled baseline is restored.

The same VM applies the custom column-width preset list `25,75` to an active
Konsole column. Physical `Meta+R` input selects 75%, wraps forward to 25%, and
physical `Meta+Shift+R` wraps back to 75%. Each frame is checked against the
gap-adjusted output proportion before the setting is cleared and the exact
baseline layout is restored.

At the settled Firefox, Konsole, and XWayland xterm pointer layout, the primary
VM confirms that the separately installed overview effect is disabled and
unbound. It loads the effect through KWin, invokes its unbound action through
KGlobalAccel without assigning a test chord, leaves the overview visible for
three seconds, and rejects component errors. Its baseline requires the same
valid v2 layout digest for 400 ms before frame and focus capture. After closing
and unloading the effect, it requires identical frames, focus, desktops,
persisted layout bytes, and built-in Overview state. The retained unbound
action is invoked once more to prove it is inert after unload, while the main
extension remains loaded.

The host injects real keyboard shortcuts and absolute `Meta+left` drags through QEMU QMP, so Plasma routing and pointer behavior cannot hide behind direct invocation. The pointer checkpoint moves native Wayland Firefox into an XWayland xterm column, verifies destination width and order, then reorders the resulting stack. The VM also verifies both desktop-reorder directions and aliases against real applications while preserving desktop IDs, selection, window memberships, focus, frames, and the shared tail. It applies and restores a live gap while a real Konsole window is floating. For default width and both resize steps, it co-delivers each policy with a temporary gap barrier, restores the gap, then proves exact existing frames before the explicit action. The remaining checks cover dynamic desktops, minimized-slot navigation, column reorder, horizontal extraction, explicit consume and expel past minimized peers, tiled and floating transfers, transfer boundaries, layer navigation, stack editing, fullscreen and maximize, sizing, and viewport scrolling with native Wayland and XWayland clients. The real xterm path also verifies advertised character-cell resize increments and exact off-lattice tiled geometry. See [Shortcuts](shortcuts.md).

The VM is ephemeral, has restricted networking, and cannot be switched onto the host. The passwordless `driftile` account signs in automatically. Screen locking, display power saving, and system sleep are disabled inside the guest. The launcher closes the VM immediately after the visible checks report success or failure. The X11 Plasma session remains available from the login screen; automated integration tests cover both KWin backends.
