import { useState } from "react";
import { View } from "react-native";
import {
  AppText as Text,
  AppPressable as Pressable,
} from "../../components/ui/primitives";
import { CircularFeed } from "../../components/circular/feed";
import NormalSavedJobs from "../../components/saved/normal-jobs";
import { PageShell, cs } from "../../components/circular/shared";
export default function SavedScreen() {
  const [gov, setGov] = useState(false);
  return (
    <PageShell title="Saved">
      <View
        accessibilityRole="tablist"
        style={[cs.row, { paddingHorizontal: 24, paddingVertical: 12 }]}
      >
        {["Jobs", "Gov jobs"].map((label, i) => (
          <Pressable
            accessibilityRole="tab"
            aria-selected={gov === (i === 1)}
            accessibilityState={{ selected: gov === (i === 1) }}
            key={label}
            onPress={() => setGov(i === 1)}
            style={[cs.chip, gov === (i === 1) && cs.selected]}
          >
            <Text>{label}</Text>
          </Pressable>
        ))}
      </View>
      {gov ? <CircularFeed saved /> : <NormalSavedJobs />}
    </PageShell>
  );
}
