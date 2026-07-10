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
  readonly name: string;
}

export interface KWinWindow {
  readonly deleted: boolean;
  readonly desktops: readonly KWinVirtualDesktop[];
  readonly desktopWindow: boolean;
  readonly dialog: boolean;
  readonly dock: boolean;
  frameGeometry: KWinRect;
  readonly fullScreen: boolean;
  readonly internalId: string | { toString(): string };
  readonly managed: boolean;
  readonly maxSize: KWinSize;
  readonly maximizeMode: number;
  readonly minSize: KWinSize;
  readonly minimized: boolean;
  readonly move: boolean;
  readonly moveable: boolean;
  readonly normalWindow: boolean;
  readonly onAllDesktops: boolean;
  readonly output: KWinOutput | null;
  readonly resize: boolean;
  readonly resizeable: boolean;
  readonly specialWindow: boolean;
  readonly tile: object | null;
}

export interface KWinWorkspace {
  readonly activeScreen: KWinOutput | null;
  readonly currentDesktop: KWinVirtualDesktop | null;
  readonly desktops: readonly KWinVirtualDesktop[];
  readonly screens: readonly KWinOutput[];
  readonly stackingOrder: readonly KWinWindow[];
  readonly windowAdded: KWinSignal<[window: KWinWindow]>;
  readonly windowRemoved: KWinSignal<[window: KWinWindow]>;
  clientArea(
    option: number,
    output: KWinOutput,
    desktop: KWinVirtualDesktop,
  ): KWinRect;
  currentDesktopForScreen?(output: KWinOutput): KWinVirtualDesktop | null;
}
