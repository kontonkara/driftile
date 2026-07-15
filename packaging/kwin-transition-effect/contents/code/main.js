// SPDX-FileCopyrightText: 2026 Nikita Konton
// SPDX-License-Identifier: GPL-3.0-or-later

"use strict";

const DEFAULT_DURATION = 180;
const MAXIMUM_DURATION = 1000;
const MANAGED_PROPERTY = "driftileTransitionsManaged";
const ANIMATION_PROPERTY = "driftileTransitionAnimation";

class DriftileTransitionsEffect {
  constructor() {
    this.duration = 0;
    this.managedWindows = [];

    effect.configChanged.connect(this.loadConfig.bind(this));
    effects.windowAdded.connect(this.manage.bind(this));
    effects.windowDeleted.connect(this.unmanage.bind(this));

    this.loadConfig();
    for (const window of effects.stackingOrder) {
      this.manage(window);
    }
  }

  loadConfig() {
    const configuredDuration = Number(
      effect.readConfig("Duration", DEFAULT_DURATION),
    );
    const baseDuration = isFinite(configuredDuration)
      ? Math.min(MAXIMUM_DURATION, Math.max(0, Math.round(configuredDuration)))
      : DEFAULT_DURATION;

    this.duration = animationTime(baseDuration);
    if (this.duration <= 0) {
      for (const window of this.managedWindows) {
        this.cancelWindowAnimation(window);
      }
    }
  }

  manage(window) {
    if (!window || window[MANAGED_PROPERTY]) {
      return;
    }

    window[MANAGED_PROPERTY] = true;
    this.managedWindows.push(window);
    window.windowFrameGeometryChanged.connect(
      this.onWindowFrameGeometryChanged.bind(this),
    );
  }

  unmanage(window) {
    if (!window) {
      return;
    }

    this.cancelWindowAnimation(window);
    delete window[MANAGED_PROPERTY];
    const index = this.managedWindows.indexOf(window);
    if (index >= 0) {
      this.managedWindows.splice(index, 1);
    }
  }

  onWindowFrameGeometryChanged(window, oldGeometry) {
    this.cancelWindowAnimation(window);
    if (
      this.duration <= 0 ||
      !this.isEligible(window) ||
      !this.isValidGeometry(oldGeometry)
    ) {
      return;
    }

    const newGeometry = window.geometry;
    if (!this.isValidGeometry(newGeometry)) {
      return;
    }

    const sizeChanged =
      oldGeometry.width !== newGeometry.width ||
      oldGeometry.height !== newGeometry.height;
    const translation = {
      value1:
        oldGeometry.x -
        newGeometry.x -
        (newGeometry.width / 2 - oldGeometry.width / 2),
      value2:
        oldGeometry.y -
        newGeometry.y -
        (newGeometry.height / 2 - oldGeometry.height / 2),
    };
    const positionChanged =
      translation.value1 !== 0 || translation.value2 !== 0;

    if (!sizeChanged && !positionChanged) {
      return;
    }

    const animations = [];
    if (sizeChanged) {
      animations.push({
        type: Effect.Size,
        from: {
          value1: oldGeometry.width,
          value2: oldGeometry.height,
        },
        to: {
          value1: newGeometry.width,
          value2: newGeometry.height,
        },
        curve: QEasingCurve.OutCubic,
      });
    }
    if (positionChanged) {
      animations.push({
        type: Effect.Translation,
        from: translation,
        to: { value1: 0, value2: 0 },
        curve: QEasingCurve.OutCubic,
      });
    }

    window[ANIMATION_PROPERTY] = animate({
      window,
      duration: this.duration,
      animations,
    });
  }

  isEligible(window) {
    return (
      !effects.hasActiveFullScreenEffect &&
      window.visible &&
      !window.deleted &&
      !window.minimized &&
      !window.fullScreen &&
      !window.hiddenByShowDesktop &&
      !window.specialWindow &&
      window.normalWindow &&
      window.managed &&
      !window.move &&
      !window.resize
    );
  }

  isValidGeometry(geometry) {
    return (
      geometry &&
      isFinite(geometry.x) &&
      isFinite(geometry.y) &&
      isFinite(geometry.width) &&
      isFinite(geometry.height) &&
      geometry.width > 0 &&
      geometry.height > 0
    );
  }

  cancelWindowAnimation(window) {
    if (!window || window[ANIMATION_PROPERTY] === undefined) {
      return;
    }

    cancel(window[ANIMATION_PROPERTY]);
    delete window[ANIMATION_PROPERTY];
  }
}

new DriftileTransitionsEffect();
