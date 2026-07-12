#!/usr/bin/env gjs

imports.gi.versions.Gtk = "3.0";

const { Gtk } = imports.gi;
const baseTitle = ARGV[ARGV.length - 1];
const phaseNames = ["initial", "constrained", "relaxed"];

if (!baseTitle) {
  throw new Error("missing base window title");
}

Gtk.init(null);

let activationSeen = false;
let phase = 0;
const window = new Gtk.Window({
  default_height: 240,
  default_width: 360,
});
const label = new Gtk.Label();

function updateWindow() {
  const phaseTitle = `${baseTitle} ${phaseNames[phase]}`;
  const title = `${phaseTitle}${window.is_active ? " [active]" : ""}`;

  window.set_size_request(phase === 1 ? 700 : 1, 1);
  window.set_title(title);
  label.set_label(title);
}

window.add(label);
window.connect("destroy", () => Gtk.main_quit());
window.connect("notify::is-active", () => {
  if (window.is_active) {
    activationSeen = true;
  } else if (activationSeen && phase < phaseNames.length - 1) {
    phase += 1;
  }

  updateWindow();
});

updateWindow();
window.show_all();
Gtk.main();
