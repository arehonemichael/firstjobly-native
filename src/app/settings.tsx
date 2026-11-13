import { View } from "react-native";
import { router } from "expo-router";
import { Button, PageShell, cs } from "../components/circular/shared";
export default function Settings() {
  return (
    <PageShell back title="Settings">
      <View style={cs.content}>
        <Button
          label="My profile"
          secondary
          onPress={() => router.push("/profile")}
        />
        <Button
          label="Job preferences"
          secondary
          onPress={() => router.push("/preferences")}
        />
        <Button
          label="Notification settings"
          secondary
          onPress={() => router.push("/notifications")}
        />
      </View>
    </PageShell>
  );
}
