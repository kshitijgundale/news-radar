import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { TrackerPresentation } from "./presentation";

export const colors = { canvas: "#F4F2EC", surface: "#FFFFFF", ink: "#17201B", muted: "#657068", line: "#DDE1DA", accent: "#D4563A", green: "#277451", greenSoft: "#DDEEE4", blue: "#35688A", blueSoft: "#DFECF4", amber: "#8A662B", amberSoft: "#F3EACF", red: "#A33D3D", redSoft: "#F5DEDE" };
export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) { return <View style={styles.page}><View style={[styles.content, wide && styles.wideContent]}>{children}</View></View>; }
export function StatusPill({ presentation }: { presentation: TrackerPresentation }) {
  const palette = { neutral: [colors.muted, "#ECEEEA"], progress: [colors.blue, colors.blueSoft], changed: [colors.green, colors.greenSoft], paused: [colors.amber, colors.amberSoft], error: [colors.red, colors.redSoft] }[presentation.tone];
  return <View style={[styles.pill, { backgroundColor: palette[1] }]}><Text style={[styles.pillText, { color: palette[0] }]}>{presentation.label}</Text></View>;
}
export function ActionButton({ label, onPress, disabled = false, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondaryButton, (pressed || disabled) && styles.pressed]}><Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text></Pressable>;
}
export function LoadingState({ label = "Loading…" }: { label?: string }) { return <View style={styles.center}><ActivityIndicator color={colors.accent} /><Text style={styles.muted}>{label}</Text></View>; }
export function ErrorState({ message, retry }: { message: string; retry: () => void }) { return <View style={styles.center}><Text style={styles.errorTitle}>Something went off radar</Text><Text style={styles.muted}>{message}</Text><ActionButton label="Try again" onPress={retry} /></View>; }
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.canvas, alignItems: "center" }, content: { flex: 1, width: "100%", maxWidth: 760 }, wideContent: { maxWidth: 1320 }, pill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }, pillText: { fontSize: 12, fontWeight: "700" }, button: { minHeight: 48, borderRadius: 14, backgroundColor: colors.ink, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" }, secondaryButton: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 }, pressed: { opacity: 0.6 }, buttonText: { color: colors.surface, fontSize: 15, fontWeight: "700" }, secondaryText: { color: colors.ink }, center: { flex: 1, padding: 32, alignItems: "center", justifyContent: "center", gap: 14 }, errorTitle: { color: colors.ink, fontSize: 20, fontWeight: "700" }, muted: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" } });
