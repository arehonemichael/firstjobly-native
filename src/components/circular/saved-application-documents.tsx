import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { AppText as Text } from "../ui/primitives";
import { Button, cs } from "./shared";
import { supabase } from "../../lib/supabase";
import { applications } from "../../lib/circular/client";
import { prepareSavedPDF } from "../../lib/circular/io";

type Document = {
  id: string;
  kind: string;
  file_path: string;
  file_name: string;
};
/** Explicit selection: never attach every private profile document silently. */
export function SavedApplicationDocuments({
  owner,
  application,
  onError,
}: {
  owner: string;
  application: string;
  onError(error: Error): void;
}) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const locked = useRef(false);
  useEffect(() => {
    const ticket = ++generation.current;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("user_documents")
          .select("id,kind,file_path,file_name")
          .eq("user_id", owner);
        if (ticket !== generation.current) return;
        if (error) throw error;
        setDocuments(
          (data ?? []).filter((doc) => /\.pdf$/i.test(doc.file_name)),
        );
      } catch {
        if (ticket === generation.current) setLoadError(true);
      } finally {
        if (ticket === generation.current) setLoading(false);
      }
    })();
    return () => {
      generation.current = ticket + 1;
    };
  }, [owner, revision]);
  async function select(doc: Document) {
    if (locked.current) return;
    const session = applications.get(owner, application);
    if (!session) return;
    if (doc.kind !== "cv" && (session.supporting?.length ?? 0) >= 4) {
      onError(
        Error("Remove a supporting PDF before adding another (maximum four)."),
      );
      return;
    }
    locked.current = true;
    setBusy(true);
    const ticket = generation.current;
    try {
      const current = () =>
        ticket === generation.current &&
        applications.get(owner, application) === session;
      const file = await prepareSavedPDF(
        doc.file_name,
        async () => {
          const { data, error } = await supabase.storage
            .from("documents")
            .createSignedUrl(doc.file_path, 60);
          if (error || !data?.signedUrl)
            throw Error(
              "Could not open your saved document. Please try again.",
            );
          return data.signedUrl;
        },
        current,
      );
      if (doc.kind === "cv")
        applications.setFile(owner, application, "cv", file.uri, file.name);
      else
        applications.setSupporting(owner, application, [
          ...(session.supporting ?? []),
          file,
        ]);
    } catch (error) {
      if (ticket === generation.current)
        onError(
          error instanceof Error
            ? error
            : Error("Could not prepare this document."),
        );
    } finally {
      locked.current = false;
      if (ticket === generation.current) setBusy(false);
    }
  }
  return (
    <View style={cs.card}>
      <Text style={cs.heading}>Use documents from your profile</Text>
      <Text style={cs.muted}>
        Choose your saved CV and only the supporting PDFs this advert requires.
        No need to upload them again.
      </Text>
      {loading ? (
        <Text>Loading saved PDFs…</Text>
      ) : loadError ? (
        <>
          <Text>
            Saved documents could not load. You can still choose PDFs from your
            phone.
          </Text>
          <Button
            secondary
            label="Retry saved documents"
            onPress={() => {
              setLoading(true);
              setDocuments([]);
              setLoadError(false);
              setRevision((v) => v + 1);
            }}
          />
        </>
      ) : !documents.length ? (
        <Text>No saved PDFs. Choose documents from your phone above.</Text>
      ) : (
        documents.map((doc) => (
          <Button
            key={doc.id}
            secondary
            disabled={busy}
            label={`${doc.kind === "cv" ? "Use saved CV" : "Add saved supporting PDF"}: ${doc.file_name}`}
            onPress={() => void select(doc)}
          />
        ))
      )}
      {busy && (
        <Text accessibilityLiveRegion="polite">Preparing document…</Text>
      )}
    </View>
  );
}
