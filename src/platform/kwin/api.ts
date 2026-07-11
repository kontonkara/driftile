export interface KWinSignal<TArguments extends unknown[]> {
  connect(handler: (...arguments_: TArguments) => void): void;
  disconnect(handler: (...arguments_: TArguments) => void): void;
}

export interface KWinVirtualDesktop {
  readonly id: string;
}

export interface KWinRect {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface KWinSize {
  readonly height: number;
  readonly width: number;
}

export interface KWinOutput {
  readonly devicePixelRatio: number;
  readonly geometry: KWinRect;
  readonly geometryChanged?: KWinSignal<[]>;
  readonly name: string;
  readonly scaleChanged?: KWinSignal<[]>;
}

export interface KWinWindow {
  readonly clientGeometry: KWinRect;
  readonly decorationChanged?: KWinSignal<[]>;
  readonly decorationPolicyChanged?: KWinSignal<[]>;
  readonly deleted: boolean;
  desktops: readonly KWinVirtualDesktop[];
  readonly desktopsChanged?: KWinSignal<[]>;
  readonly desktopWindow: boolean;
  readonly dialog: boolean;
  readonly dock: boolean;
  frameGeometry: KWinRect;
  readonly frameGeometryChanged?: KWinSignal<[oldGeometry: KWinRect]>;
  fullScreen: boolean;
  readonly fullScreenChanged?: KWinSignal<[]>;
  readonly fullScreenable?: boolean;
  readonly hiddenChanged?: KWinSignal<[]>;
  readonly internalId: string | { toString(): string };
  readonly interactiveMoveResizeFinished?: KWinSignal<[]>;
  readonly managed: boolean;
  readonly maximizedAboutToChange?: KWinSignal<[mode: number]>;
  readonly maximizeableChanged?: KWinSignal<[maximizeable: boolean]>;
  readonly maximizedChanged?: KWinSignal<[]>;
  readonly maxSize: KWinSize;
  readonly maximizeMode: number;
  readonly minSize: KWinSize;
  readonly minimized: boolean;
  readonly minimizedChanged?: KWinSignal<[]>;
  readonly modal: boolean;
  readonly modalChanged?: KWinSignal<[]>;
  readonly move: boolean;
  readonly moveable: boolean;
  readonly moveResizedChanged?: KWinSignal<[]>;
  noBorder?: boolean;
  readonly noBorderChanged?: KWinSignal<[]>;
  readonly normalWindow: boolean;
  readonly onAllDesktops: boolean;
  readonly output: KWinOutput | null;
  readonly outputChanged?: KWinSignal<[oldOutput?: KWinOutput | null]>;
  readonly requestedTileChanged?: KWinSignal<[]>;
  readonly resize: boolean;
  readonly resizeable: boolean;
  readonly specialWindow: boolean;
  readonly tile: object | null;
  readonly tileChanged?: KWinSignal<[tile: object | null]>;
  readonly transient: boolean;
  readonly transientChanged?: KWinSignal<[]>;
  readonly transientFor: KWinWindow | null;
}

export interface KWinWorkspace {
  activeWindow: KWinWindow | null;
  readonly activeScreen: KWinOutput | null;
  currentDesktop: KWinVirtualDesktop | null;
  readonly desktops: readonly KWinVirtualDesktop[];
  readonly screens: readonly KWinOutput[];
  readonly screensChanged?: KWinSignal<[]>;
  readonly stackingOrder: readonly KWinWindow[];
  readonly currentDesktopChanged: KWinSignal<
    [
      previous: KWinVirtualDesktop | null,
      current?: KWinVirtualDesktop | null,
      output?: KWinOutput,
    ]
  >;
  readonly desktopsChanged?: KWinSignal<[]>;
  readonly windowActivated: KWinSignal<[window: KWinWindow | null]>;
  readonly windowAdded: KWinSignal<[window: KWinWindow]>;
  readonly windowRemoved: KWinSignal<[window: KWinWindow]>;
  readonly virtualScreenGeometryChanged?: KWinSignal<[]>;
  clientArea(
    option: number,
    output: KWinOutput,
    desktop: KWinVirtualDesktop,
  ): KWinRect;
  createDesktop?(position: number, name: string): void;
  currentDesktopForScreen?(output: KWinOutput): KWinVirtualDesktop | null;
  removeDesktop?(desktop: KWinVirtualDesktop): void;
  sendClientToScreen?(window: KWinWindow, output: KWinOutput): void;
  setCurrentDesktopForScreen?(
    desktop: KWinVirtualDesktop,
    output: KWinOutput,
  ): void;
}
