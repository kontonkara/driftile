// SPDX-FileCopyrightText: 2026 Nikita Konton
// SPDX-License-Identifier: GPL-3.0-or-later

"use strict";

const DEFAULT_DURATION = 180;
const MAXIMUM_DURATION = 1000;
const MAXIMUM_EXCLUSION_COUNT = 128;
const MAXIMUM_EXCLUSION_BYTES = 255;
const MAXIMUM_EXCLUSION_CONFIG_BYTES = 33024;
const MANAGED_PROPERTY = "driftileTransitionsManaged";
const ANIMATION_PROPERTY = "driftileTransitionAnimation";
const DEFERRED_PROPERTY = "driftileDeferredTransition";
const POSITION_ANIMATION = "position";
const TRANSLATION_ANIMATIONS = "translations";
const POSITION_MODE_PROPERTY = "positionMode";
const ABSOLUTE_POSITION_MODE = "absolute";
const TRANSLATION_POSITION_MODE = "translation";
const MAXIMUM_TRANSLATION_ANIMATIONS = 32;
const SIZE_ANIMATION = "size";

class DriftileTransitionsEffect {
  constructor() {
    this.duration = 0;
    this.animatePosition = true;
    this.animateSize = true;
    this.windowClassExclusionsValid = true;
    this.windowClassExclusions = new Set();
    this.managedWindows = [];

    effect.configChanged.connect(this.loadConfig.bind(this));
    effects.windowAdded.connect(this.manage.bind(this));
    effects.windowDeleted.connect(this.unmanage.bind(this));
    if (effects.hasActiveFullScreenEffectChanged) {
      effects.hasActiveFullScreenEffectChanged.connect(
        this.onFullScreenEffectChanged.bind(this),
      );
    }
    if (effects.desktopChanged) {
      effects.desktopChanged.connect(
        this.onVisibilityContextChanged.bind(this),
      );
    }
    if (effects.currentActivityChanged) {
      effects.currentActivityChanged.connect(
        this.onVisibilityContextChanged.bind(this),
      );
    }

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
    this.animatePosition = this.readBooleanConfig("AnimatePosition", true);
    this.animateSize = this.readBooleanConfig("AnimateSize", true);
    const exclusionConfig = this.parseWindowClassExclusions(
      effect.readConfig("WindowClassExclusions", ""),
    );
    this.windowClassExclusionsValid = exclusionConfig.valid;
    this.windowClassExclusions = exclusionConfig.exclusions;
    for (const window of this.managedWindows) {
      this.clearWindowTransitions(window);
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
    if (window.windowHiddenChanged) {
      window.windowHiddenChanged.connect(
        this.onWindowVisibilityOpportunity.bind(this),
      );
    }
    if (window.windowDesktopsChanged) {
      window.windowDesktopsChanged.connect(
        this.onWindowVisibilityOpportunity.bind(this),
      );
    }
  }

  unmanage(window) {
    if (!window) {
      return;
    }

    this.clearWindowTransitions(window);
    delete window[MANAGED_PROPERTY];
    const index = this.managedWindows.indexOf(window);
    if (index >= 0) {
      this.managedWindows.splice(index, 1);
    }
  }

  onWindowFrameGeometryChanged(window, oldGeometry) {
    if (
      this.duration <= 0 ||
      !this.isDeferredTransitionEligible(window) ||
      !this.isValidGeometry(oldGeometry)
    ) {
      this.clearWindowTransitions(window);
      return;
    }

    const newGeometry = window.geometry;
    if (!this.isValidGeometry(newGeometry)) {
      this.clearWindowTransitions(window);
      return;
    }

    if (!this.geometryChanged(oldGeometry, newGeometry)) {
      return;
    }

    if (effects.hasActiveFullScreenEffect) {
      this.deferWindowTransition(window, oldGeometry);
      return;
    }

    if (window[DEFERRED_PROPERTY] !== undefined) {
      this.replayDeferredTransition(window);
      return;
    }

    if (!this.isEligible(window)) {
      this.clearWindowTransitions(window);
      return;
    }

    this.animateWindowTransition(window, oldGeometry, newGeometry);
  }

  onFullScreenEffectChanged() {
    if (effects.hasActiveFullScreenEffect) {
      return;
    }

    for (const window of this.managedWindows) {
      this.replayDeferredTransition(window);
    }
  }

  onVisibilityContextChanged() {
    for (const window of this.managedWindows) {
      this.replayDeferredTransition(window);
    }
  }

  onWindowVisibilityOpportunity(window) {
    this.replayDeferredTransition(window);
  }

  deferWindowTransition(window, oldGeometry) {
    if (window[DEFERRED_PROPERTY] !== undefined) {
      return;
    }

    this.cancelWindowAnimation(window);
    window[DEFERRED_PROPERTY] = this.copyGeometry(oldGeometry);
  }

  replayDeferredTransition(window) {
    const oldGeometry = window && window[DEFERRED_PROPERTY];
    if (oldGeometry === undefined) {
      return;
    }

    if (effects.hasActiveFullScreenEffect) {
      return;
    }

    const newGeometry = window.geometry;
    if (
      this.duration <= 0 ||
      !this.isDeferredTransitionEligible(window) ||
      !this.isValidGeometry(oldGeometry) ||
      !this.isValidGeometry(newGeometry)
    ) {
      this.clearWindowTransitions(window);
      return;
    }

    if (!window.visible) {
      return;
    }

    delete window[DEFERRED_PROPERTY];
    this.animateWindowTransition(window, oldGeometry, newGeometry);
  }

  animateWindowTransition(window, oldGeometry, newGeometry) {
    if (!this.geometryChanged(oldGeometry, newGeometry)) {
      return;
    }

    const sizeChanged =
      this.animateSize &&
      (oldGeometry.width !== newGeometry.width ||
        oldGeometry.height !== newGeometry.height);
    const oldPositionWidth = this.animateSize
      ? oldGeometry.width
      : newGeometry.width;
    const oldPositionHeight = this.animateSize
      ? oldGeometry.height
      : newGeometry.height;
    const oldPosition = {
      value1: oldGeometry.x + oldPositionWidth / 2,
      value2: oldGeometry.y + oldPositionHeight / 2,
    };
    const newPosition = {
      value1: newGeometry.x + newGeometry.width / 2,
      value2: newGeometry.y + newGeometry.height / 2,
    };
    const positionChanged =
      this.animatePosition &&
      (oldPosition.value1 !== newPosition.value1 ||
        oldPosition.value2 !== newPosition.value2);
    const usesAbsolutePosition =
      positionChanged &&
      this.canAnimateAbsolutePosition(oldPosition, newPosition);

    if (!sizeChanged && !positionChanged) {
      return;
    }

    const state = this.windowAnimationState(window);
    const previousPositionMode = state[POSITION_MODE_PROPERTY];
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
    if (usesAbsolutePosition) {
      if (!this.retargetAbsolutePosition(state, newPosition)) {
        animationProperties.push(POSITION_ANIMATION);
        animations.push({
          type: Effect.Position,
          from: oldPosition,
          to: newPosition,
          curve: QEasingCurve.OutCubic,
        });
      }
    } else if (positionChanged) {
      animationProperties.push(POSITION_ANIMATION);
      animations.push({
        type: Effect.Translation,
        from: {
          value1: oldPosition.value1 - newPosition.value1,
          value2: oldPosition.value2 - newPosition.value2,
        },
        to: { value1: 0, value2: 0 },
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
        const property = animationProperties[index];
        const animationId = animationIds[index];
        if (property === SIZE_ANIMATION) {
          state[property] = animationId;
        } else if (usesAbsolutePosition) {
          if (previousPositionMode === TRANSLATION_POSITION_MODE) {
            this.cancelTranslationAnimations(state);
          }
          state[POSITION_ANIMATION] = animationId;
          state[POSITION_MODE_PROPERTY] = ABSOLUTE_POSITION_MODE;
        } else {
          if (previousPositionMode === ABSOLUTE_POSITION_MODE) {
            this.cancelAbsolutePositionAnimation(state);
          }
          this.trackTranslationAnimation(state, animationId);
          state[POSITION_MODE_PROPERTY] = TRANSLATION_POSITION_MODE;
        }
      }
    }

    window[ANIMATION_PROPERTY] = state;
  }

  isEligible(window) {
    return window.visible && this.isDeferredTransitionEligible(window);
  }

  isDeferredTransitionEligible(window) {
    return (
      !window.deleted &&
      !window.minimized &&
      !window.fullScreen &&
      !window.hiddenByShowDesktop &&
      !window.specialWindow &&
      !window.popupWindow &&
      !window.appletPopup &&
      !window.onScreenDisplay &&
      !window.outline &&
      !window.lockScreen &&
      !window.internalWindow &&
      !window.skipSwitcher &&
      !window.modal &&
      window.transientFor() === null &&
      window.normalWindow &&
      window.managed &&
      window.moveable &&
      (window.hasDecoration || !window.keepAbove) &&
      !this.isConfiguredWindowExcluded(window) &&
      !window.move &&
      !window.resize
    );
  }

  readBooleanConfig(name, fallback) {
    const value = effect.readConfig(name, fallback);
    if (value === false || value === 0 || value === "false" || value === "0") {
      return false;
    }
    if (value === true || value === 1 || value === "true" || value === "1") {
      return true;
    }
    return fallback;
  }

  parseWindowClassExclusions(configuredValue) {
    const exclusions = new Set();
    if (typeof configuredValue !== "string") {
      return { valid: false, exclusions };
    }

    const totalBytes = this.utf8ByteLength(configuredValue);
    if (totalBytes < 0 || totalBytes > MAXIMUM_EXCLUSION_CONFIG_BYTES) {
      return { valid: false, exclusions };
    }

    const normalizedValue = configuredValue.replace(/\r\n/gu, "\n");
    if (
      normalizedValue.includes("\r") ||
      /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/u.test(normalizedValue)
    ) {
      return { valid: false, exclusions };
    }

    for (const configuredLine of normalizedValue.split("\n")) {
      const windowClass = configuredLine.trim();
      if (windowClass.length === 0) {
        continue;
      }
      if (exclusions.has(windowClass)) {
        return { valid: false, exclusions: new Set() };
      }

      const entryBytes = this.utf8ByteLength(windowClass);
      if (
        entryBytes <= 0 ||
        entryBytes > MAXIMUM_EXCLUSION_BYTES ||
        exclusions.size >= MAXIMUM_EXCLUSION_COUNT
      ) {
        return { valid: false, exclusions: new Set() };
      }
      exclusions.add(windowClass);
    }

    return { valid: true, exclusions };
  }

  utf8ByteLength(value) {
    let bytes = 0;
    for (let index = 0; index < value.length; index += 1) {
      const codeUnit = value.charCodeAt(index);
      if (codeUnit <= 0x7f) {
        bytes += 1;
      } else if (codeUnit <= 0x7ff) {
        bytes += 2;
      } else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
        const nextCodeUnit = value.charCodeAt(index + 1);
        if (!(nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff)) {
          return -1;
        }
        bytes += 4;
        index += 1;
      } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
        return -1;
      } else {
        bytes += 3;
      }
    }
    return bytes;
  }

  isConfiguredWindowExcluded(window) {
    if (!this.windowClassExclusionsValid) {
      return true;
    }
    if (this.windowClassExclusions.size === 0) {
      return false;
    }

    const windowClass = window.windowClass;
    return (
      typeof windowClass === "string" &&
      this.windowClassExclusions.has(windowClass)
    );
  }

  geometryChanged(oldGeometry, newGeometry) {
    return (
      oldGeometry.x !== newGeometry.x ||
      oldGeometry.y !== newGeometry.y ||
      oldGeometry.width !== newGeometry.width ||
      oldGeometry.height !== newGeometry.height
    );
  }

  copyGeometry(geometry) {
    return {
      x: geometry.x,
      y: geometry.y,
      width: geometry.width,
      height: geometry.height,
    };
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

  retargetAbsolutePosition(state, target) {
    if (state[POSITION_MODE_PROPERTY] !== ABSOLUTE_POSITION_MODE) {
      return false;
    }

    if (this.retargetAnimation(state, POSITION_ANIMATION, target)) {
      return true;
    }

    delete state[POSITION_MODE_PROPERTY];
    return false;
  }

  trackTranslationAnimation(state, animationId) {
    let animationIds = state[TRANSLATION_ANIMATIONS];
    if (!Array.isArray(animationIds)) {
      if (animationIds !== undefined) {
        cancel(animationIds);
      }
      animationIds = [];
      state[TRANSLATION_ANIMATIONS] = animationIds;
    }

    animationIds.push(animationId);
    while (animationIds.length > MAXIMUM_TRANSLATION_ANIMATIONS) {
      cancel(animationIds.shift());
    }
  }

  cancelAbsolutePositionAnimation(state) {
    if (state[POSITION_ANIMATION] !== undefined) {
      cancel(state[POSITION_ANIMATION]);
      delete state[POSITION_ANIMATION];
    }
  }

  cancelTranslationAnimations(state) {
    const animationIds = state[TRANSLATION_ANIMATIONS];
    if (Array.isArray(animationIds)) {
      for (const animationId of animationIds) {
        cancel(animationId);
      }
    } else if (animationIds !== undefined) {
      cancel(animationIds);
    }
    delete state[TRANSLATION_ANIMATIONS];
  }

  cancelPositionAnimations(state) {
    this.cancelAbsolutePositionAnimation(state);
    this.cancelTranslationAnimations(state);
    delete state[POSITION_MODE_PROPERTY];
  }

  canAnimateAbsolutePosition(oldPosition, newPosition) {
    return (
      oldPosition.value1 >= 0 &&
      oldPosition.value2 >= 0 &&
      newPosition.value1 >= 0 &&
      newPosition.value2 >= 0
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

    const state = window[ANIMATION_PROPERTY];
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      cancel(state);
      delete window[ANIMATION_PROPERTY];
      return;
    }

    if (state[SIZE_ANIMATION] !== undefined) {
      cancel(state[SIZE_ANIMATION]);
    }
    this.cancelPositionAnimations(state);
    delete window[ANIMATION_PROPERTY];
  }

  clearWindowTransitions(window) {
    if (!window) {
      return;
    }

    this.cancelWindowAnimation(window);
    delete window[DEFERRED_PROPERTY];
  }
}

new DriftileTransitionsEffect();
