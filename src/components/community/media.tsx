import { useRef, useState } from "react";
import { Modal, View } from "react-native";
import { Image } from "expo-image";
import { AppText as Text, AppPressable as Pressable } from "../ui/primitives";
import type { Media } from "../../lib/community/contract";
import { Button, CommunityScreen, s } from "./shared";
function PhotoTile({
  photo,
  onOpen,
  renew,
}: {
  photo: Media;
  onOpen(): void;
  renew(): void;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const renewed = useRef(false);
  const failed = failedUrl === photo.url;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="View discussion photo"
      onPress={onOpen}
      style={{
        flexGrow: 1,
        flexBasis: "45%",
        minWidth: 96,
        height: 150,
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {failed ? (
        <View style={[s.notice, { flex: 1, justifyContent: "center" }]}>
          <Text style={s.muted}>
            Photo unavailable. Refresh the discussion to try again.
          </Text>
        </View>
      ) : (
        <Image
          source={{ uri: photo.url }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          cachePolicy="none"
          accessibilityLabel="Discussion photo"
          onError={() => {
            setFailedUrl(photo.url);
            if (!renewed.current) {
              renewed.current = true;
              renew();
            }
          }}
        />
      )}
    </Pressable>
  );
}
export function CommunityMedia({
  media,
  renew,
}: {
  media: Media[];
  renew(): void;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const start = useRef(0);
  const safe = media
    .slice(0, 4)
    .filter((photo) => /^https:\/\//i.test(photo.url));
  const photo = index === null ? undefined : safe[index];
  function move(next: number) {
    setFailed(false);
    setIndex(Math.max(0, Math.min(safe.length - 1, next)));
  }
  return (
    <>
      {!!safe.length && (
        <View style={s.row}>
          {safe.map((photo, i) => (
            <PhotoTile
              key={i}
              photo={photo}
              onOpen={() => move(i)}
              renew={renew}
            />
          ))}
        </View>
      )}
      <Modal
        visible={!!photo}
        animationType="fade"
        onRequestClose={() => setIndex(null)}
      >
        <CommunityScreen>
          <View style={[s.content, { flex: 1 }]}>
            <View style={s.row}>
              <Button label="Close photos" onPress={() => setIndex(null)} />
              <Text style={s.body}>
                {(index ?? 0) + 1} / {safe.length}
              </Text>
            </View>
            <View
              style={{ flex: 1 }}
              onTouchStart={(e) => {
                start.current = e.nativeEvent.pageX;
              }}
              onTouchEnd={(e) => {
                const delta = e.nativeEvent.pageX - start.current;
                if (Math.abs(delta) > 50)
                  move((index ?? 0) + (delta < 0 ? 1 : -1));
              }}
            >
              {photo && !failed ? (
                <Image
                  source={{ uri: photo.url }}
                  cachePolicy="none"
                  contentFit="contain"
                  style={{ width: "100%", height: "100%" }}
                  accessibilityLabel="Full discussion photo"
                  onError={() => setFailed(true)}
                />
              ) : (
                <Text style={s.body}>
                  Photo unavailable. Close and refresh the discussion.
                </Text>
              )}
            </View>
            <View style={s.row}>
              <Button
                label="Previous photo"
                disabled={index === 0}
                onPress={() => move((index ?? 0) - 1)}
              />
              <Button
                label="Next photo"
                disabled={index === safe.length - 1}
                onPress={() => move((index ?? 0) + 1)}
              />
            </View>
          </View>
        </CommunityScreen>
      </Modal>
    </>
  );
}
