const ALLOWED_AVATAR_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);

export function isAllowedAvatarFile(file: File): boolean {
  return ALLOWED_AVATAR_TYPES.has(file.type);
}

export function getSafeAvatarUrl(value: string | null | undefined, currentOrigin: string): string | null {
  if (!value) return null;

  try {
    const url = new URL(value, currentOrigin);
    if (url.protocol === "https:") return url.href;
    if (url.protocol === "http:" && url.origin === currentOrigin) return url.href;
  } catch {
    return null;
  }

  return null;
}
