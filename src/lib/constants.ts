/**
 * Application Constants
 */

export const DEFAULT_DRIVER_APK_URL =
  "https://expo.dev/artifacts/eas/y3iEKz_3Q6RisVA7JtEqu_9mWMCGxCBnET53qL1LdLQ.apk";

export const DEFAULT_CLIENT_APK_URL =
  "https://expo.dev/artifacts/eas/Alru0UQaj9Beokj2ncwcm9dGiOhtBlAeQ9B2pJWu56g.apk";

export const PERMANENT_DRIVER_APK_PATH = "/download/driver-apk";
export const PERMANENT_CLIENT_APK_PATH = "/download/client-apk";

export function getDriverApkUrl(): string {
  return (
    process.env.NEXT_PUBLIC_DRIVER_APK_URL ||
    process.env.DRIVER_APK_URL ||
    DEFAULT_DRIVER_APK_URL
  );
}

export function getClientApkUrl(): string {
  return (
    process.env.NEXT_PUBLIC_CLIENT_APK_URL ||
    process.env.CLIENT_APK_URL ||
    DEFAULT_CLIENT_APK_URL
  );
}

export function getPermanentDriverApkUrl(): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "https://rayons.net");
  return `${baseUrl}${PERMANENT_DRIVER_APK_PATH}`;
}

export function getPermanentClientApkUrl(): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "https://rayons.net");
  return `${baseUrl}${PERMANENT_CLIENT_APK_PATH}`;
}
