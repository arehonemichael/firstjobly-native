import { useEffect, useRef, useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "../ui/primitives";
import { REPORT_REASONS } from "../../lib/community/contract";
import { communityApi } from "../../lib/community/api";
import { Button, CommunityScreen, ErrorBox, s } from "./shared";

export function useConfirm() {
  const [question, setQuestion] = useState("");
  const resolve = useRef<((value: boolean) => void) | null>(null);
  useEffect(() => () => resolve.current?.(false), []);
  const finish = (value: boolean) => {
    setQuestion("");
    resolve.current?.(value);
    resolve.current = null;
  };
  return {
    confirm(message: string) {
      resolve.current?.(false);
      setQuestion(message);
      return new Promise<boolean>((done) => {
        resolve.current = done;
      });
    },
    dialog: (
      <Modal
        visible={!!question}
        transparent
        animationType="fade"
        onRequestClose={() => finish(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(6,26,48,.5)",
            justifyContent: "center",
            padding: 24,
          }}
          accessibilityViewIsModal
        >
          <View style={s.card}>
            <Text style={s.heading}>{question}</Text>
            <View style={s.row}>
              <Button label="Cancel" onPress={() => finish(false)} />
              <Button primary label="Confirm" onPress={() => finish(true)} />
            </View>
          </View>
        </View>
      </Modal>
    ),
  };
}
export function ReportDialog({
  owner,
  target,
  close,
}: {
  owner: string;
  target: { postId: string } | { commentId: string };
  close(message?: string): void;
}) {
  const [reason, setReason] = useState<keyof typeof REPORT_REASONS | "">("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<Error | null>(null);
  async function submit() {
    if (!reason || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await communityApi(owner, "report", {
        ...target,
        reason,
        ...(details.trim() ? { details: details.trim() } : {}),
      });
      close("Thanks — a moderator will review this.");
    } catch (error) {
      setError(error as Error);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => !busy && close()}
    >
      <CommunityScreen>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
        >
          <Text style={s.title}>
            Report this {"postId" in target ? "discussion" : "reply"}
          </Text>
          <Text style={s.body}>
            Reports are private. A moderator will review it.
          </Text>
          {Object.entries(REPORT_REASONS).map(([value, label]) => (
            <Button
              key={value}
              label={label}
              selected={reason === value}
              onPress={() => setReason(value as keyof typeof REPORT_REASONS)}
            />
          ))}
          <TextInput
            accessibilityLabel="Report details"
            placeholder="Optional details"
            multiline
            maxLength={1000}
            value={details}
            onChangeText={setDetails}
            style={[s.field, { minHeight: 100 }]}
          />
          <Text style={s.muted}>{details.length}/1000</Text>
          <ErrorBox error={error} />
          <Button
            primary
            label={busy ? "Sending report…" : "Send report"}
            disabled={!reason || busy}
            onPress={() => void submit()}
          />
          <Button label="Cancel" disabled={busy} onPress={() => close()} />
        </ScrollView>
      </CommunityScreen>
    </Modal>
  );
}
