import { Image, Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import type { Photo } from "./contract";
export function validatePhoto(data: string, width: number, height: number) {
  const raw = data.replace(/^data:[^;]+;base64,/, "");
  if (!raw.startsWith("/9j/") && !raw.startsWith("iVBORw0KGgo"))
    return "Choose a JPEG or PNG photo. WebP is not supported.";
  const size =
    Math.floor((raw.length * 3) / 4) -
    (raw.endsWith("==") ? 2 : raw.endsWith("=") ? 1 : 0);
  if (size > 5 * 1024 * 1024) return "Each photo must be 5 MB or smaller.";
  if (!(width > 0 && height > 0) || width > 4000 || height > 4000)
    return "Photos must be no more than 4000 pixels per side.";
  return "";
}
export async function pickPhotos(remaining: number): Promise<Photo[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["image/jpeg", "image/png"],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  if (result.assets.length > remaining)
    throw new Error("You can attach up to 4 photos.");
  const photos: Photo[] = [];
  for (const asset of result.assets) {
    if (asset.size && asset.size > 5 * 1024 * 1024)
      throw new Error("Each photo must be 5 MB or smaller.");
    const bytes =
      Platform.OS === "web" ? asset.file?.size : new File(asset.uri).size;
    if (bytes && bytes > 5 * 1024 * 1024)
      throw new Error("Each photo must be 5 MB or smaller.");
    let data: string;
    if (Platform.OS === "web") {
      if (!asset.file)
        throw new Error("This photo couldn't be read. Please choose it again.");
      data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Couldn't read the photo."));
        reader.readAsDataURL(asset.file!);
      });
    } else {
      data = await new File(asset.uri).base64();
    }
    const size = await new Promise<{ width: number; height: number }>(
      (resolve, reject) =>
        Image.getSize(
          asset.uri,
          (width, height) => resolve({ width, height }),
          () => reject(new Error("Couldn't read the photo dimensions.")),
        ),
    );
    const problem = validatePhoto(data, size.width, size.height);
    if (problem) throw new Error(problem);
    const raw = data.replace(/^data:[^;]+;base64,/, "");
    photos.push({
      data: `data:image/${raw.startsWith("/9j/") ? "jpeg" : "png"};base64,${raw}`,
      ...size,
      name: asset.name,
    });
  }
  return photos;
}
