// SPDX-FileCopyrightText: 2026 Nikita Konton
// SPDX-License-Identifier: GPL-3.0-or-later

"use strict";

const DEFAULT_DURATION = 180;
const MAXIMUM_DURATION = 1000;
const MANAGED_PROPERTY = "driftileTransitionsManaged";
const ANIMATION_PROPERTY = "driftileTransitionAnimation";
const POSITION_ANIMATION = "position";
const SIZE_ANIMATION = "size";

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
    for (const window of this.managedWindows) {
      this.cancelWindowAnimation(window);
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
    if (
      this.duration <= 0 ||
      !this.isEligible(window) ||
      !this.isValidGeometry(oldGeometry)
    ) {
      this.cancelWindowAnimation(window);
      return;
    }

    const newGeometry = window.geometry;
    if (!this.isValidGeometry(newGeometry)) {
      this.cancelWindowAnimation(window);
      return;
    }

    const sizeChanged =
      oldGeometry.width !== newGeometry.width ||
      oldGeometry.height !== newGeometry.height;
    const oldPosition = {
      value1: oldGeometry.x + oldGeometry.width / 2,
      value2: oldGeometry.y + oldGeometry.height / 2,
    };
    const newPosition = {
      value1: newGeometry.x + newGeometry.width / 2,
      value2: newGeometry.y + newGeometry.height / 2,
    };
    const positionChanged =
      oldPosition.value1 !== newPosition.value1 ||
      oldPosition.value2 !== newPosition.value2;

    if (!sizeChanged && !positionChanged) {
      return;
    }

    const state = this.windowAnimationState(window);
    const animations = [];
    const animationProperties = [];
    const newSize = {
      value1: newGeometry.width,
      value2: newGeometry.height,
    };

    if (
      sizeChanged &&
      !this.retargetAnimation(state, SIZE_ANIMATION, newSize)
    ) {
      animationProperties.push(SIZE_ANIMATION);
      animations.push({
        type: Effect.Size,
        from: {
          value1: oldGeometry.width,
          value2: oldGeometry.height,
        },
        to: newSize,
        curve: QEasingCurve.OutCubic,
      });
    }
    if (
      positionChanged &&
      !this.retargetAnimation(state, POSITION_ANIMATION, newPosition)
    ) {
      animationProperties.push(POSITION_ANIMATION);
      animations.push({
        type: Effect.Position,
        from: oldPosition,
        to: newPosition,
        curve: QEasingCurve.OutCubic,
      });
    }

    if (animations.length > 0) {
      const animationIds = animate({
        window,
        duration: this.duration,
        animations,
      });

      for (let index = 0; index < animationProperties.length; index += 1) {
        state[animationProperties[index]] = animationIds[index];
      }
    }

    window[ANIMATION_PROPERTY] = state;
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
      !window.popupWindow &&
      !window.appletPopup &&
      !window.modal &&
      window.transientFor() === null &&
      window.normalWindow &&
      window.managed &&
      window.moveable &&
      (window.hasDecoration || (!window.keepAbove && !window.skipSwitcher)) &&
      !window.move &&
      !window.resize
    );
  }

  windowAnimationState(window) {
    const state = window[ANIMATION_PROPERTY];
    if (state && typeof state === "object" && !Array.isArray(state)) {
      return state;
    }

    if (state !== undefined) {
      cancel(state);
    }
    return {};
  }

  retargetAnimation(state, property, target) {
    const animationId = state[property];
    if (animationId === undefined) {
      return false;
    }

    if (retarget(animationId, target, this.duration)) {
      return true;
    }

    delete state[property];
    return false;
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

    const state = window[ANIMATION_PROPERTY];
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      cancel(state);
      delete window[ANIMATION_PROPERTY];
      return;
    }

    if (state[SIZE_ANIMATION] !== undefined) {
      cancel(state[SIZE_ANIMATION]);
    }
    if (state[POSITION_ANIMATION] !== undefined) {
      cancel(state[POSITION_ANIMATION]);
    }
    delete window[ANIMATION_PROPERTY];
  }
}

new DriftileTransitionsEffect();
