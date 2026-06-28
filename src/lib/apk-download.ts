/** Версия APK в git — обновляй при новой сборке */
export const APK_GIT_TAG = "3545356";

export const APK_FILE_NAME = "lang-center.apk";
export const APK_SIZE_MB = "3.9";

/** CDN раздаёт файл отдельно — сайт не тормозит */
export const APK_CDN_URL = `https://cdn.jsdelivr.net/gh/rolimzod16-dotcom/LANGCENTER@${APK_GIT_TAG}/public/downloads/${APK_FILE_NAME}`;

/** Ссылка на сайте — редирект на CDN */
export const APK_DOWNLOAD_PATH = "/api/download/apk";