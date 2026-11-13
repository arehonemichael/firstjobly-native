import { Redirect, useLocalSearchParams } from "expo-router";
export default function LegacyDiscussion() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  return <Redirect href={{ pathname: "/community/[postId]", params: { postId } }} />;
}
