import { Redirect } from "expo-router";
/** Preserve installed clients' old destinations without the obsolete service. */
export default function LegacyGraduateRoom() { return <Redirect href="/community" />; }
