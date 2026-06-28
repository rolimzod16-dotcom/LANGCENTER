/** Версия APK в git — обновляй при новой сборке */
export const APK_GIT_TAG = "3545356";

export const APK_FILE_NAME = "lang-center.apk";
export const APK_SIZE_MB = "3.9";

/** Резервная ссылка (если статика недоступна) */
export const APK_CDN_URL = `https://cdn.jsdelivr.net/gh/rolimzod16-dotcom/LANGCENTER@${APK_GIT_TAG}/public/downloads/${APK_FILE_NAME}`;

/** Прямая загрузка с вашего сайта — меньше предупреждений, чем через CDN */
export const APK_DOWNLOAD_PATH = "/downloads/lang-center.apk";