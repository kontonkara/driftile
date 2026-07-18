const PICTURE_IN_PICTURE_WINDOW_ROLE = "pictureinpicture";

export type PictureInPictureWindowRoleState = "match" | "other" | "unavailable";

export function hasAutomaticFloatingRole(candidate: unknown): boolean {
  if (!isExternalObject(candidate)) {
    return false;
  }

  try {
    return (
      candidate["dialog"] === true ||
      candidate["modal"] === true ||
      candidate["transient"] === true ||
      isExternalObject(candidate["transientFor"]) ||
      candidate["utility"] === true ||
      pictureInPictureWindowRoleState(candidate) === "match"
    );
  } catch {
    return false;
  }
}

export function pictureInPictureWindowRoleState(
  candidate: unknown,
): PictureInPictureWindowRoleState {
  if (!isExternalObject(candidate)) {
    return "unavailable";
  }

  try {
    return classifyPictureInPictureWindowRole(candidate["windowRole"]);
  } catch {
    return "unavailable";
  }
}

function classifyPictureInPictureWindowRole(
  value: unknown,
): PictureInPictureWindowRoleState {
  if (typeof value !== "string") {
    return "unavailable";
  }

  if (value.length === 0) {
    return "unavailable";
  }

  const roleStart = value.lastIndexOf(":") + 1;
  let tokenIndex = 0;

  for (let index = roleStart; index < value.length; index += 1) {
    let code = value.charCodeAt(index);

    if (code === 32 || code === 45 || code === 95) {
      continue;
    }

    if (code >= 65 && code <= 90) {
      code += 32;
    }

    if (
      tokenIndex >= PICTURE_IN_PICTURE_WINDOW_ROLE.length ||
      code !== PICTURE_IN_PICTURE_WINDOW_ROLE.charCodeAt(tokenIndex)
    ) {
      return "other";
    }

    tokenIndex += 1;
  }

  return tokenIndex === PICTURE_IN_PICTURE_WINDOW_ROLE.length
    ? "match"
    : "other";
}

function isExternalObject(
  candidate: unknown,
): candidate is Record<string, unknown> {
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    !Array.isArray(candidate)
  );
}
