import type { TrackerListItem } from "@radar/contracts";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { listTrackers } from "../src/api";
import { presentTracker } from "../src/presentation";
import { ActionButton, colors, ErrorState, LoadingState, Page, StatusPill } from "../src/ui";

export default function TrackersScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const [trackers, setTrackers] = useState<TrackerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try { setTrackers(await listTrackers()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load trackers"); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const activeCount = trackers.filter((tracker) => tracker.status === "active").length;
  const updatedCount = trackers.filter((tracker) => tracker.latestRun?.outcome === "changed").length;
  const needsAttentionCount = trackers.filter((tracker) => tracker.latestRun?.status === "failed").length;

  const header = <View>
    <View style={[styles.topbar, isWide && styles.topbarWide]}>
      <View style={styles.brand}><View style={styles.brandMark}><View style={styles.brandDot} /></View><Text style={styles.brandName}>RADAR</Text></View>
      <ActionButton label="+  New tracker" onPress={() => router.push("/new")} />
    </View>

    <View style={[styles.hero, isWide && styles.heroWide]}>
      <View style={styles.heroCopy}>
        <Text style={styles.heroEyebrow}>YOUR SITUATION ROOM</Text>
        <Text style={[styles.heroTitle, isWide && styles.heroTitleWide]}>Follow what changed.{"\n"}<Text style={styles.heroTitleAccent}>Skip the noise.</Text></Text>
        <Text style={styles.heroBody}>Radar turns scattered reporting into a concise current state and a timeline of meaningful developments.</Text>
      </View>
      <View style={[styles.radarVisual, !isWide && styles.radarVisualMobile]}>
        <View style={[styles.ring, styles.ringOuter]} /><View style={[styles.ring, styles.ringMiddle]} /><View style={[styles.ring, styles.ringInner]} />
        <View style={styles.sweep} /><View style={styles.signal}><View style={styles.signalCore} /></View>
      </View>
    </View>

    <View style={[styles.metrics, isWide && styles.metricsWide]}>
      <View style={styles.metric}><Text style={styles.metricValue}>{trackers.length}</Text><Text style={styles.metricLabel}>TOTAL TRACKERS</Text></View>
      <View style={styles.metricDivider} />
      <View style={styles.metric}><Text style={styles.metricValue}>{activeCount}</Text><Text style={styles.metricLabel}>ACTIVE</Text></View>
      <View style={styles.metricDivider} />
      <View style={styles.metric}><Text style={styles.metricValue}>{updatedCount}</Text><Text style={styles.metricLabel}>UPDATED</Text></View>
      <View style={styles.metricDivider} />
      <View style={styles.metric}><Text style={[styles.metricValue, needsAttentionCount > 0 && styles.metricAlert]}>{needsAttentionCount}</Text><Text style={styles.metricLabel}>NEEDS ATTENTION</Text></View>
    </View>

    <View style={styles.sectionHeader}>
      <View><Text style={styles.sectionEyebrow}>LIVE MONITORING</Text><Text style={styles.sectionTitle}>Your trackers</Text></View>
      <Text style={styles.sectionMeta}>{trackers.length === 1 ? "1 situation" : `${trackers.length} situations`}</Text>
    </View>
    {error && trackers.length > 0 ? <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retryText}>Retry</Text></Pressable></View> : null}
  </View>;

  if (loading && trackers.length === 0) return <Page wide><Stack.Screen options={{ headerShown: false }} /><LoadingState label="Finding your trackers…" /></Page>;
  if (error && trackers.length === 0) return <Page wide><Stack.Screen options={{ headerShown: false }} /><ErrorState message={error} retry={() => void load()} /></Page>;

  return <Page wide><Stack.Screen options={{ headerShown: false }} /><FlatList
    key={isWide ? "wide" : "compact"}
    data={trackers}
    numColumns={isWide ? 2 : 1}
    keyExtractor={(item) => item.id}
    ListHeaderComponent={header}
    columnWrapperStyle={isWide ? styles.columns : undefined}
    contentContainerStyle={[styles.pageContent, isWide && styles.pageContentWide, trackers.length === 0 && styles.emptyList]}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}
    ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyIcon}><View style={styles.emptyDot} /></View><Text style={styles.emptyTitle}>Nothing on your radar yet</Text><Text style={styles.emptyBody}>Start with a developing situation. Radar will build the baseline and keep the important changes in view.</Text><ActionButton label="Create your first tracker" onPress={() => router.push("/new")} /></View>}
    renderItem={({ item }) => {
      const presentation = presentTracker(item);
      return <Pressable onPress={() => router.push({ pathname: "/tracker/[id]", params: { id: item.id } })} style={({ pressed }) => [styles.card, isWide && styles.cardWide, pressed && styles.pressed]}>
        <View style={styles.cardTop}><StatusPill presentation={presentation} /><Text style={styles.cardTime}>{presentation.detail}</Text></View>
        <Text style={styles.cardTitle}>{item.title ?? item.query}</Text>
        {item.title ? <Text style={styles.query} numberOfLines={2}>{item.query}</Text> : null}
        <Text style={styles.summary} numberOfLines={3}>{item.summary ?? "Radar is establishing the first concise Current State."}</Text>
        <View style={styles.cardFooter}><Text style={styles.openLabel}>OPEN TRACKER</Text><View style={styles.arrowCircle}><Text style={styles.arrow}>→</Text></View></View>
      </Pressable>;
    }}
  /></Page>;
}

const styles = StyleSheet.create({
  pageContent: { padding: 20, paddingBottom: 60 }, pageContentWide: { paddingHorizontal: 40, paddingTop: 28, paddingBottom: 80 }, emptyList: { flexGrow: 1 },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 22 }, topbarWide: { marginBottom: 28 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 }, brandMark: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.accent, alignItems: "center", justifyContent: "center" }, brandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }, brandName: { color: colors.ink, fontSize: 13, fontWeight: "900", letterSpacing: 2.5 },
  hero: { minHeight: 330, overflow: "hidden", backgroundColor: colors.ink, borderRadius: 28, padding: 28, position: "relative" }, heroWide: { minHeight: 355, padding: 44, justifyContent: "center" },
  heroCopy: { maxWidth: 710, zIndex: 2 }, heroEyebrow: { color: "#C9D0CB", fontSize: 11, fontWeight: "900", letterSpacing: 2 }, heroTitle: { color: colors.surface, fontSize: 39, lineHeight: 45, fontWeight: "900", letterSpacing: -1.2, marginTop: 17 }, heroTitleWide: { fontSize: 58, lineHeight: 64, letterSpacing: -2 }, heroTitleAccent: { color: "#ED765A" }, heroBody: { color: "#B9C3BC", fontSize: 16, lineHeight: 24, maxWidth: 600, marginTop: 20 },
  radarVisual: { position: "absolute", right: 32, top: 18, width: 320, height: 320, alignItems: "center", justifyContent: "center", opacity: 0.75 }, radarVisualMobile: { right: -115, top: 75, opacity: 0.28 }, ring: { position: "absolute", borderWidth: 1, borderColor: "rgba(237,118,90,0.42)", borderRadius: 999 }, ringOuter: { width: 300, height: 300 }, ringMiddle: { width: 205, height: 205 }, ringInner: { width: 108, height: 108 }, sweep: { position: "absolute", width: 145, height: 2, backgroundColor: colors.accent, transform: [{ translateX: 72 }, { rotate: "-32deg" }], opacity: 0.75 }, signal: { position: "absolute", right: 66, top: 75, width: 27, height: 27, borderRadius: 14, backgroundColor: "rgba(237,118,90,0.25)", alignItems: "center", justifyContent: "center" }, signalCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF8A6E" },
  metrics: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 18, marginTop: 14, flexDirection: "row", justifyContent: "space-around", alignItems: "center" }, metricsWide: { paddingHorizontal: 32, paddingVertical: 22 }, metric: { flex: 1, alignItems: "center" }, metricValue: { color: colors.ink, fontSize: 25, fontWeight: "900" }, metricAlert: { color: colors.red }, metricLabel: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1, marginTop: 4, textAlign: "center" }, metricDivider: { width: 1, height: 35, backgroundColor: colors.line },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 42, marginBottom: 16 }, sectionEyebrow: { color: colors.accent, fontSize: 10, fontWeight: "900", letterSpacing: 1.8 }, sectionTitle: { color: colors.ink, fontSize: 28, fontWeight: "900", letterSpacing: -0.6, marginTop: 4 }, sectionMeta: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  columns: { gap: 16, alignItems: "stretch" }, card: { backgroundColor: colors.surface, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: colors.line, marginBottom: 14, minHeight: 260 }, cardWide: { width: "49%", padding: 24, minHeight: 290 }, pressed: { opacity: 0.72, transform: [{ scale: 0.995 }] },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }, cardTime: { color: colors.muted, fontSize: 11, fontWeight: "700" }, cardTitle: { color: colors.ink, fontSize: 22, fontWeight: "800", lineHeight: 28, marginTop: 17 }, query: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 8 }, summary: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 16, flexGrow: 1 }, cardFooter: { borderTopWidth: 1, borderColor: colors.line, paddingTop: 15, marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, openLabel: { color: colors.ink, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }, arrowCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" }, arrow: { color: colors.surface, fontSize: 18, lineHeight: 20 },
  errorBanner: { backgroundColor: colors.redSoft, borderRadius: 13, padding: 13, marginBottom: 14, flexDirection: "row", justifyContent: "space-between" }, errorText: { color: colors.red, fontSize: 13 }, retryText: { color: colors.red, fontSize: 13, fontWeight: "800" },
  empty: { flex: 1, minHeight: 330, justifyContent: "center", alignItems: "center", padding: 32, gap: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 22 }, emptyIcon: { width: 58, height: 58, borderRadius: 29, borderWidth: 1, borderColor: colors.accent, alignItems: "center", justifyContent: "center", marginBottom: 4 }, emptyDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent }, emptyTitle: { color: colors.ink, fontSize: 25, fontWeight: "800", textAlign: "center" }, emptyBody: { color: colors.muted, fontSize: 15, lineHeight: 23, textAlign: "center", maxWidth: 520, marginBottom: 7 },
});
