import { NextResponse } from "next/server";
import { APK_CDN_URL, APK_FILE_NAME } from "@/lib/apk-download";
import { readFile } from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const localPath = path.join(
      process.cwd(),
      "public",
      "downloads",
      APK_FILE_NAME,
    );
    const buffer = await readFile(localPath);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": `attachment; filename="${APK_FILE_NAME}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.redirect(APK_CDN_URL, 302);
  }
}