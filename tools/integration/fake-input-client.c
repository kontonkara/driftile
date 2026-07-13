// SPDX-FileCopyrightText: 2026 Driftile contributors
//
// SPDX-License-Identifier: GPL-3.0-or-later

#include <errno.h>
#include <limits.h>
#include <signal.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include <linux/input-event-codes.h>
#include <wayland-client.h>

#include "fake-input-client-protocol.h"

static struct wl_display *display;
static struct wl_registry *registry;
static struct org_kde_kwin_fake_input *fake_input;
static bool meta_pressed;
static bool right_button_pressed;
static volatile sig_atomic_t received_signal;

static void release_inputs(void) {
  if (fake_input != NULL) {
    if (right_button_pressed) {
      org_kde_kwin_fake_input_button(fake_input, BTN_RIGHT, 0);
      right_button_pressed = false;
    }

    if (meta_pressed) {
      org_kde_kwin_fake_input_keyboard_key(fake_input, KEY_LEFTMETA, 0);
      meta_pressed = false;
    }

    if (display != NULL) {
      (void)wl_display_flush(display);
      (void)wl_display_roundtrip(display);
    }

    org_kde_kwin_fake_input_destroy(fake_input);
    fake_input = NULL;
  }

  if (registry != NULL) {
    wl_registry_destroy(registry);
    registry = NULL;
  }

  if (display != NULL) {
    wl_display_disconnect(display);
    display = NULL;
  }
}

static void handle_signal(int signal_number) {
  received_signal = signal_number;
}

static bool install_signal_handlers(void) {
  const struct sigaction action = {
      .sa_handler = handle_signal,
  };

  return sigaction(SIGINT, &action, NULL) == 0 &&
         sigaction(SIGTERM, &action, NULL) == 0 &&
         sigaction(SIGHUP, &action, NULL) == 0;
}

static bool roundtrip(void) {
  return received_signal == 0 && wl_display_roundtrip(display) >= 0;
}

static bool settle_input(void) {
  struct timespec delay = {
      .tv_nsec = 50 * 1000 * 1000,
  };

  if (!roundtrip()) {
    return false;
  }

  while (nanosleep(&delay, &delay) != 0) {
    if (errno != EINTR || received_signal != 0) {
      return false;
    }
  }

  return received_signal == 0;
}

static void registry_global(void *data, struct wl_registry *wl_registry,
                            uint32_t name, const char *interface,
                            uint32_t version) {
  (void)data;

  if (fake_input == NULL &&
      strcmp(interface, org_kde_kwin_fake_input_interface.name) == 0 &&
      version >= 5) {
    const uint32_t bind_version = version < 6 ? version : 6;
    fake_input = wl_registry_bind(wl_registry, name,
                                  &org_kde_kwin_fake_input_interface,
                                  bind_version);
  }
}

static void registry_global_remove(void *data, struct wl_registry *wl_registry,
                                   uint32_t name) {
  (void)data;
  (void)wl_registry;
  (void)name;
}

static const struct wl_registry_listener registry_listener = {
    .global = registry_global,
    .global_remove = registry_global_remove,
};

static bool parse_coordinate(const char *text, int32_t *coordinate) {
  char *end = NULL;
  long value;

  errno = 0;
  value = strtol(text, &end, 10);

  if (errno != 0 || end == text || *end != '\0' || value < INT32_MIN ||
      value > INT32_MAX) {
    return false;
  }

  *coordinate = (int32_t)value;
  return true;
}

static int drag_resize(int32_t start_x, int32_t start_y, int32_t end_x,
                       int32_t end_y) {
  const int32_t midpoint_x =
      (int32_t)(((int64_t)start_x + (int64_t)end_x) / 2);
  const int32_t midpoint_y =
      (int32_t)(((int64_t)start_y + (int64_t)end_y) / 2);

  org_kde_kwin_fake_input_pointer_motion_absolute(
      fake_input, wl_fixed_from_int(start_x), wl_fixed_from_int(start_y));
  if (!settle_input()) {
    return 1;
  }

  org_kde_kwin_fake_input_keyboard_key(fake_input, KEY_LEFTMETA, 1);
  meta_pressed = true;
  if (!settle_input()) {
    return 1;
  }

  org_kde_kwin_fake_input_button(fake_input, BTN_RIGHT, 1);
  right_button_pressed = true;
  if (!settle_input()) {
    return 1;
  }

  org_kde_kwin_fake_input_pointer_motion_absolute(
      fake_input, wl_fixed_from_int(midpoint_x), wl_fixed_from_int(midpoint_y));
  if (!settle_input()) {
    return 1;
  }

  org_kde_kwin_fake_input_pointer_motion_absolute(
      fake_input, wl_fixed_from_int(end_x), wl_fixed_from_int(end_y));
  if (!settle_input()) {
    return 1;
  }

  org_kde_kwin_fake_input_button(fake_input, BTN_RIGHT, 0);
  right_button_pressed = false;
  if (!settle_input()) {
    return 1;
  }

  org_kde_kwin_fake_input_keyboard_key(fake_input, KEY_LEFTMETA, 0);
  meta_pressed = false;
  return roundtrip() ? 0 : 1;
}

int main(int argc, char **argv) {
  int32_t end_x;
  int32_t end_y;
  int32_t start_x;
  int32_t start_y;
  int result;

  if (argc != 5 || !parse_coordinate(argv[1], &start_x) ||
      !parse_coordinate(argv[2], &start_y) ||
      !parse_coordinate(argv[3], &end_x) ||
      !parse_coordinate(argv[4], &end_y)) {
    fprintf(stderr, "usage: %s START_X START_Y END_X END_Y\n", argv[0]);
    return 2;
  }

  if (!install_signal_handlers() || atexit(release_inputs) != 0) {
    fputs("could not install fake-input cleanup\n", stderr);
    return 1;
  }

  display = wl_display_connect(NULL);
  if (display == NULL) {
    fputs("could not connect to the Wayland display\n", stderr);
    return 1;
  }

  registry = wl_display_get_registry(display);
  if (registry == NULL) {
    fputs("could not acquire the Wayland registry\n", stderr);
    return 1;
  }

  if (wl_registry_add_listener(registry, &registry_listener, NULL) != 0 ||
      !roundtrip() || fake_input == NULL) {
    fputs("KWin fake input is unavailable\n", stderr);
    return 1;
  }

  org_kde_kwin_fake_input_authenticate(
      fake_input, "Driftile integration",
      "Verify one completed horizontal pointer resize");
  if (!roundtrip()) {
    fputs("KWin fake-input authentication failed\n", stderr);
    return 1;
  }

  result = drag_resize(start_x, start_y, end_x, end_y);
  if (result != 0) {
    fputs(received_signal == 0 ? "fake-input resize drag failed\n"
                               : "fake-input resize drag interrupted\n",
          stderr);
  }

  return result;
}
