export const SESSION_NAMES = ["user", "admin"] as const;

export type SessionName = (typeof SESSION_NAMES)[number];
