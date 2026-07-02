// Native file download + share helper. Uses the server-generated CSV/PDF
// exports on monitor.envirolytics.in and falls back to a plain URL open on web.
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { getAuthToken } from "@/src/api/client";

export type DownloadResult = { uri: string; filename: string } | { error: string };

export async function downloadAndShare({
  url,
  filename,
  mime,
}: {
  url: string;
  filename: string;
  mime: string;
}): Promise<DownloadResult> {
  if (Platform.OS === "web") {
    // On web, plain link open (browser handles Content-Disposition).
    if (typeof window !== "undefined") {
      const token = await getAuthToken();
      // Fetch as blob so we can attach the Authorization header, then let the
      // browser download it.
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return { error: `HTTP ${res.status}` };
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      return { uri: objectUrl, filename };
    }
    return { error: "Unavailable" };
  }

  const token = await getAuthToken();
  const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!dir) return { error: "No writable directory" };
  const target = `${dir}${filename}`;
  try {
    const res = await FileSystem.downloadAsync(url, target, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.status < 200 || res.status >= 300) {
      return { error: `HTTP ${res.status}` };
    }
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(res.uri, {
        mimeType: mime,
        dialogTitle: filename,
        UTI: mime === "application/pdf" ? "com.adobe.pdf" : "public.comma-separated-values-text",
      });
    }
    return { uri: res.uri, filename };
  } catch (e: any) {
    return { error: e?.message || "Download failed" };
  }
}
