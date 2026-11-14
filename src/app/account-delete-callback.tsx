import { useEffect } from "react";
import { activeGoogleVerification } from "../lib/account/google-reauth";
import { View } from "react-native";
import { router } from "expo-router";
import { AppText as Text } from "../components/ui/primitives";
import { Button, PageShell, cs } from "../components/circular/shared";
/** PKCE exchange is handled only by the active WebBrowser auth session. Never
 * exchange arbitrary incoming URL tokens/code automatically from a route. */
export default function DeletionCallback() {
  useEffect(() => {
    let active = true;
    const task = activeGoogleVerification();
    const back = () => {
      if (active) {
        if (router.canGoBack()) router.back();
        else router.replace("/account-delete");
      }
    };
    if (task) void task.then(back, back);
    return () => {
      active = false;
    };
  }, []);
  return (
    <PageShell title="Account verification">
      <View style={cs.content}>
        <Text>
          Return to the deletion screen after Google verification. Review your
          email and confirm deletion there.
        </Text>
        <Button
          label="Back to account deletion"
          onPress={() => router.replace("/account-delete")}
        />
      </View>
    </PageShell>
  );
}
