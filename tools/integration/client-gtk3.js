#!/usr/bin/env gjs

imports.gi.versions.Gtk = "3.0";

const { Gtk } = imports.gi;
const title = ARGV[ARGV.length - 1];

if (!title) {
  throw new Error("missing window title");
}

Gtk.init(null);

const window = new Gtk.Window({
  default_height: 240,
  default_width: 360,
  title,
});

window.connect("destroy", () => Gtk.main_quit());
window.show_all();
Gtk.main();
