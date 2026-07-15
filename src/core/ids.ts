declare const idBrand: unique symbol;

type Id<TName extends string> = string & {
  readonly [idBrand]: TName;
};

export type ActivityId = Id<"ActivityId">;
export type ColumnId = Id<"ColumnId">;
export type DesktopId = Id<"DesktopId">;
export type OutputId = Id<"OutputId">;
export type WindowId = Id<"WindowId">;

export function activityId(value: string): ActivityId {
  return value as ActivityId;
}

export function columnId(value: string): ColumnId {
  return value as ColumnId;
}

export function desktopId(value: string): DesktopId {
  return value as DesktopId;
}

export function outputId(value: string): OutputId {
  return value as OutputId;
}

export function windowId(value: string): WindowId {
  return value as WindowId;
}
