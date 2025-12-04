const palette = {
  primary: "#1d4ed8",
  primaryDark: "#1e3a8a",
  background: "#f6f7fb",
  surface: "#ffffff",
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  border: "#cbd5f5",
  success: "#22c55e",
  waiting: "#2563eb",
  taken: "#f59e0b",
  completed: "#10b981",
};

export default {
  light: {
    text: palette.textPrimary,
    secondaryText: palette.textSecondary,
    background: palette.background,
    surface: palette.surface,
    tint: palette.primary,
    tintDark: palette.primaryDark,
    border: palette.border,
    success: palette.success,
    waiting: palette.waiting,
    taken: palette.taken,
    completed: palette.completed,
    tabIconDefault: "#a5b4fc",
    tabIconSelected: palette.primary,
  },
};

export type ThemeColors = typeof palette;
