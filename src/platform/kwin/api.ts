export interface KWinSignal<TArguments extends unknown[]> {
  connect(handler: (...arguments_: TArguments) => void): void;
  disconnect(handler: (...arguments_: TArguments) => void): void;
}

export interface KWinVirtualDesktop {
  readonly id: string;
}

export interface KWinOutput {
  readonly name: string;
}

export interface KWinWindow {
  readonly desktops: readonly KWinVirtualDesktop[];
  readonly desktopWindow: boolean;
  readonly dialog: boolean;
  readonly dock: boolean;
  readonly internalId: string | { toString(): string };
  readonly normalWindow: boolean;
  readonly output: KWinOutput | null;
  readonly specialWindow: boolean;
}

export interface KWinWorkspace {
  readonly stackingOrder: readonly KWinWindow[];
  readonly windowAdded: KWinSignal<[window: KWinWindow]>;
  readonly windowRemoved: KWinSignal<[window: KWinWindow]>;
}
