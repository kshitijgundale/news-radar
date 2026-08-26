import type { TrackerDetail } from "@radar/contracts";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { checkTracker, deleteTracker, getTracker, pauseTracker, reactivateTracker, updateTrackerSchedule } from "../../src/api";
import { presentTracker, runIsBusy } from "../../src/presentation";
import { scheduleLabel, scheduleOptions } from "../../src/schedule";
import { ActionButton, colors, ErrorState, LoadingState, Page, StatusPill } from "../../src/ui";

export default function TrackerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 1_000;
  const [tracker, setTracker] = useState<TrackerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!id) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try { setTracker(await getTracker(id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load tracker"); }
    finally { setLoading(false); setRefreshing(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!tracker || !runIsBusy(tracker.latestRun)) return;
    const timer = setInterval(() => void load(true), 4_000);
    return () => clearInterval(timer);
  }, [load, tracker]);

  const act = async (operation: () => Promise<unknown>) => {
    setActing(true); setError(null);
    try { await operation(); await load(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Action failed"); }
    finally { setActing(false); }
  };

  const removeTracker = async () => {
    setDeleteConfirmOpen(false); setActing(true); setError(null);
    try { await deleteTracker(tracker!.id); router.replace("/"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete tracker"); setActing(false); }
  };

  if (loading && !tracker) return <Page><LoadingState label="Reading Current State…" /></Page>;
  if (!tracker) return <Page><ErrorState message={error ?? "Tracker not found"} retry={() => void load()} /></Page>;

  const presentation = presentTracker(tracker);
  const busy = runIsBusy(tracker.latestRun);
  const timeline = <View style={[styles.panel, isWide && styles.sidebarPanel]}>
    <Text style={styles.panelEyebrow}>ACTIVITY</Text><Text style={styles.panelTitle}>Timeline</Text>
    {tracker.timeline.length === 0 ? <Text style={styles.muted}>Meaningful changes will appear here after the baseline.</Text> : <View style={styles.timeline}>{tracker.timeline.map((point) => <View key={point.id} style={styles.point}><Text style={styles.pointDate}>{new Date(point.detectedAt).toLocaleDateString()}</Text><Text style={styles.pointTitle}>{point.headline}</Text><Text style={styles.pointDetail}>{point.detail}</Text>{point.occurredAt ? <Text style={styles.occurred}>Occurred {new Date(point.occurredAt).toLocaleDateString()}</Text> : null}</View>)}</View>}
  </View>;

  const controls = <View style={[styles.panel, isWide && styles.sidebarPanel]}>
    <Text style={styles.panelEyebrow}>TRACKER SETTINGS</Text><Text style={styles.panelTitle}>Check frequency</Text><Text style={styles.muted}>Currently {scheduleLabel(tracker.pollIntervalMinutes).toLowerCase()}.</Text>
    <View style={styles.scheduleOptions}>{scheduleOptions.map((option) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: tracker.pollIntervalMinutes === option.minutes }} disabled={acting} key={option.minutes} onPress={() => void act(() => updateTrackerSchedule(tracker.id, option.minutes))} style={[styles.scheduleOption, tracker.pollIntervalMinutes === option.minutes && styles.scheduleSelected]}><Text style={[styles.scheduleText, tracker.pollIntervalMinutes === option.minutes && styles.scheduleTextSelected]}>{option.label}</Text></Pressable>)}</View>
    <View style={styles.actions}>{tracker.status === "paused" ? <ActionButton label={acting ? "Reactivating…" : "Reactivate"} disabled={acting} onPress={() => void act(() => reactivateTracker(tracker.id))} /> : <ActionButton label={acting || busy ? "Checking…" : "Check now"} disabled={acting || busy} onPress={() => void act(() => checkTracker(tracker.id))} />}{tracker.status !== "paused" ? <ActionButton secondary label="Pause tracker" disabled={acting} onPress={() => void act(() => pauseTracker(tracker.id))} /> : null}<Pressable accessibilityRole="button" disabled={acting} onPress={() => setDeleteConfirmOpen(true)} style={({ pressed }) => [styles.deleteButton, (pressed || acting) && styles.deletePressed]}><Text style={styles.deleteText}>Delete tracker</Text></Pressable></View>
  </View>;

  return <><Page wide><Stack.Screen options={{ title: tracker.title ?? "Tracker" }} /><ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />} contentContainerStyle={[styles.content, isWide && styles.contentWide]}>
    <Pressable accessibilityRole="link" accessibilityLabel="Back to all trackers" onPress={() => router.replace("/")} style={({ pressed }) => [styles.backLink, pressed && styles.backLinkPressed]}><Text style={styles.backArrow}>←</Text><Text style={styles.backText}>All trackers</Text></Pressable>
    <View style={[styles.header, isWide && styles.headerWide]}><View style={styles.headerCopy}><StatusPill presentation={presentation} /><Text style={[styles.title, isWide && styles.titleWide]}>{tracker.title ?? tracker.query}</Text>{tracker.title ? <Text style={styles.query}>{tracker.query}</Text> : null}</View><View style={[styles.headerMeta, isWide && styles.headerMetaWide]}><Text style={styles.metaLabel}>LAST CHECK</Text><Text style={styles.metaValue}>{presentation.detail}</Text>{tracker.nextCheckAt ? <Text style={styles.nextCheck}>Next {new Date(tracker.nextCheckAt).toLocaleString()}</Text> : null}</View></View>
    {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
    {!tracker.currentState ? <View style={styles.baseline}><Text style={styles.baselineTitle}>{tracker.latestRun?.status === "failed" ? "Baseline needs another try" : "Establishing the baseline"}</Text><Text style={styles.muted}>Radar is gathering evidence and building the first concise Current State. Pull down to refresh.</Text></View> : <View style={styles.summaryCard}><Text style={styles.sectionLabel}>SUMMARY</Text><Text style={[styles.summary, isWide && styles.summaryWide]}>{tracker.currentState.summary}</Text></View>}
    <View style={[styles.dashboard, isWide && styles.dashboardWide]}><View style={styles.mainColumn}><View style={styles.sectionHeader}><Text style={styles.heading}>Current State</Text>{tracker.currentState ? <Text style={styles.sectionCount}>{tracker.currentState.facts.length} facts</Text> : null}</View>
      {!tracker.currentState ? <Text style={styles.muted}>Current State will appear when the baseline succeeds.</Text> : <View style={[styles.facts, isWide && styles.factsWide]}>{tracker.currentState.facts.map((fact) => <View key={fact.id} style={[styles.fact, isWide && styles.factWide]}><View style={[styles.factDot, fact.status === "confirmed" ? styles.confirmed : fact.status === "reported" ? styles.reported : fact.status === "uncertain" ? styles.uncertain : styles.disputed]} /><View style={styles.factBody}><Text style={styles.factText}>{fact.text}</Text><Text style={styles.factStatus}>{fact.status.toUpperCase()}</Text></View></View>)}</View>}
      {!isWide ? timeline : null}
      <View style={styles.sourcesPanel}><Pressable onPress={() => setSourcesOpen((value) => !value)} style={styles.sourcesToggle}><View><Text style={styles.panelEyebrow}>EVIDENCE</Text><Text style={styles.sourcesTitle}>Supporting sources ({tracker.evidence.length})</Text></View><Text style={styles.chevron}>{sourcesOpen ? "−" : "+"}</Text></Pressable>{sourcesOpen ? <View style={styles.sources}>{tracker.evidence.map((source) => <Pressable key={source.id} onPress={() => void Linking.openURL(source.canonicalUrl)} style={styles.source}><Text style={styles.sourceTitle}>{source.title}</Text><Text style={styles.sourceMeta}>{source.publisher ?? source.canonicalUrl.replace(/^https?:\/\//, "").split("/")[0]} · {source.fetchStatus}</Text></Pressable>)}</View> : null}</View>
    </View><View style={[styles.sidebar, !isWide && styles.sidebarMobile]}>{isWide ? timeline : null}{controls}</View></View>
  </ScrollView></Page><Modal animationType="fade" transparent visible={deleteConfirmOpen} onRequestClose={() => setDeleteConfirmOpen(false)}><View style={styles.modalBackdrop}><View accessibilityRole="alert" style={styles.modalCard}><Text style={styles.modalTitle}>Delete tracker?</Text><Text style={styles.modalBody}>This permanently deletes the tracker and its timeline. This cannot be undone.</Text><View style={styles.modalActions}><ActionButton secondary label="Cancel" disabled={acting} onPress={() => setDeleteConfirmOpen(false)} /><Pressable accessibilityRole="button" disabled={acting} onPress={() => void removeTracker()} style={({ pressed }) => [styles.confirmDeleteButton, (pressed || acting) && styles.deletePressed]}><Text style={styles.confirmDeleteText}>{acting ? "Deleting…" : "Delete"}</Text></Pressable></View></View></View></Modal></>;
}

const styles = StyleSheet.create({
  content: { padding: 22, paddingBottom: 60 }, contentWide: { paddingHorizontal: 40, paddingTop: 34, paddingBottom: 80 },
  backLink: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginLeft: -10, marginBottom: 22 }, backLinkPressed: { backgroundColor: colors.line }, backArrow: { color: colors.accent, fontSize: 21, lineHeight: 21, fontWeight: "700" }, backText: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  header: { gap: 18 }, headerWide: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 40 }, headerCopy: { flex: 1, maxWidth: 860 },
  title: { color: colors.ink, fontSize: 32, lineHeight: 38, fontWeight: "800", letterSpacing: -0.8, marginTop: 14 }, titleWide: { fontSize: 42, lineHeight: 48, letterSpacing: -1.2 }, query: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 9 },
  headerMeta: { gap: 5 }, headerMetaWide: { width: 270, alignItems: "flex-end" }, metaLabel: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }, metaValue: { color: colors.ink, fontSize: 15, fontWeight: "700" }, nextCheck: { color: colors.muted, fontSize: 12 },
  errorBox: { backgroundColor: colors.redSoft, borderRadius: 12, padding: 12, marginTop: 18 }, errorText: { color: colors.red, fontSize: 14 },
  baseline: { backgroundColor: colors.blueSoft, borderRadius: 20, padding: 20, marginTop: 24, gap: 8 }, baselineTitle: { color: colors.ink, fontSize: 19, fontWeight: "700" },
  summaryCard: { backgroundColor: colors.ink, borderRadius: 22, padding: 24, marginTop: 28 }, sectionLabel: { color: "#B9C3BC", fontSize: 11, fontWeight: "900", letterSpacing: 1.7 }, summary: { color: "#FFFFFF", fontSize: 21, lineHeight: 30, fontWeight: "600", marginTop: 10 }, summaryWide: { fontSize: 25, lineHeight: 35, maxWidth: 1050 },
  dashboard: { marginTop: 26 }, dashboardWide: { flexDirection: "row", alignItems: "flex-start", gap: 26 }, mainColumn: { flex: 1, minWidth: 0 }, sidebar: { gap: 18 }, sidebarMobile: { marginTop: 18 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 13 }, heading: { color: colors.ink, fontSize: 24, fontWeight: "800" }, sectionCount: { color: colors.muted, fontSize: 12, fontWeight: "700" }, muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  facts: { gap: 10 }, factsWide: { flexDirection: "row", flexWrap: "wrap" }, fact: { flexDirection: "row", backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 16, padding: 16, gap: 13 }, factWide: { width: "49%", minHeight: 126 }, factDot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 }, confirmed: { backgroundColor: colors.green }, reported: { backgroundColor: colors.blue }, uncertain: { backgroundColor: colors.amber }, disputed: { backgroundColor: colors.red }, factBody: { flex: 1, gap: 8 }, factText: { color: colors.ink, fontSize: 16, lineHeight: 23 }, factStatus: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  panel: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 18, padding: 18, marginTop: 24 }, sidebarPanel: { width: 350, marginTop: 0 }, panelEyebrow: { color: colors.accent, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }, panelTitle: { color: colors.ink, fontSize: 20, fontWeight: "800", marginTop: 5, marginBottom: 12 },
  timeline: { gap: 16 }, point: { borderLeftWidth: 2, borderLeftColor: colors.accent, paddingLeft: 14, paddingVertical: 2 }, pointDate: { color: colors.accent, fontSize: 10, fontWeight: "800" }, pointTitle: { color: colors.ink, fontSize: 15, fontWeight: "700", marginTop: 4 }, pointDetail: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }, occurred: { color: colors.muted, fontSize: 10, marginTop: 5 },
  sourcesPanel: { borderTopWidth: 1, borderColor: colors.line, marginTop: 26, paddingTop: 6 }, sourcesToggle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16 }, sourcesTitle: { color: colors.ink, fontSize: 17, fontWeight: "700", marginTop: 4 }, chevron: { color: colors.accent, fontSize: 24 }, sources: { gap: 8 }, source: { backgroundColor: colors.surface, borderRadius: 13, padding: 14 }, sourceTitle: { color: colors.ink, fontSize: 14, fontWeight: "600" }, sourceMeta: { color: colors.muted, fontSize: 11, marginTop: 5 },
  scheduleOptions: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 13 }, scheduleOption: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.canvas, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 }, scheduleSelected: { backgroundColor: colors.ink, borderColor: colors.ink }, scheduleText: { color: colors.muted, fontSize: 12, fontWeight: "700" }, scheduleTextSelected: { color: colors.surface }, actions: { gap: 9, marginTop: 18 }, deleteButton: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 5 }, deletePressed: { opacity: 0.55 }, deleteText: { color: colors.red, fontSize: 14, fontWeight: "700" }, modalBackdrop: { flex: 1, backgroundColor: "rgba(23,32,27,0.52)", alignItems: "center", justifyContent: "center", padding: 24 }, modalCard: { width: "100%", maxWidth: 430, backgroundColor: colors.surface, borderRadius: 20, padding: 24 }, modalTitle: { color: colors.ink, fontSize: 23, fontWeight: "800" }, modalBody: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 10 }, modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 24 }, confirmDeleteButton: { minHeight: 48, borderRadius: 14, backgroundColor: colors.red, paddingHorizontal: 22, alignItems: "center", justifyContent: "center" }, confirmDeleteText: { color: colors.surface, fontSize: 15, fontWeight: "700" },
});
