import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ contentStyle: { backgroundColor: "#F4F2EC" }, headerStyle: { backgroundColor: "#F4F2EC" }, headerShadowVisible: false, headerTintColor: "#17201B", headerTitleStyle: { fontWeight: "700" } }} />
    </>
  );
}
