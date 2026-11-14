import { requireOptionalNativeModule } from "expo";

type MailShare = {
  shareAsync(
    uris: string[],
    subject: string,
    body: string,
  ): Promise<"cancelled" | "handoff">;
};
// Older installed binaries keep the existing Mail composer/manual fallback.
export const mailShare =
  requireOptionalNativeModule<MailShare>("FirstJoblyMail");
