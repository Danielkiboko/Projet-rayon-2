/**
 * Application Constants
 */

export const DEFAULT_DRIVER_APK_URL =
  "https://expo.dev/artifacts/eas/CuY-nZ0kk1GwVdTmiAimwLjc34w2wMJ924j3pcK7JpM.apk";

export const PERMANENT_DRIVER_APK_PATH = "/download/driver-apk";

export function getDriverApkUrl(): string {
  return (
    process.env.NEXT_PUBLIC_DRIVER_APK_URL ||
    process.env.DRIVER_APK_URL ||
    DEFAULT_DRIVER_APK_URL
  );
}

export function getPermanentDriverApkUrl(): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "https://rayons.net");
  return `${baseUrl}${PERMANENT_DRIVER_APK_PATH}`;
}
