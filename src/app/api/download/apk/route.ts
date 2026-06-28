import { NextResponse } from "next/server";
import { APK_DOWNLOAD_PATH } from "@/lib/apk-download";

/** Старые ссылки — редирект на прямую загрузку с сайта */
export async function GET(request: Request) {
  const url = new URL(APK_DOWNLOAD_PATH, request.url);
  return NextResponse.redirect(url, 308);
}