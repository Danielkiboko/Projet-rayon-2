import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import fs from "fs";
import path from "path";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_HEADERS = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400";

async function toJpegResponse(inputBuffer: Buffer): Promise<NextResponse> {
  try {
    const jpegBuf = await sharp(inputBuffer)
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#FFFFFF" })
      .jpeg({ quality: 88 })
      .toBuffer();

    return new NextResponse(new Uint8Array(jpegBuf), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(jpegBuf.length),
        "Cache-Control": CACHE_HEADERS,
      },
    });
  } catch {
    return new NextResponse(new Uint8Array(inputBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(inputBuffer.length),
        "Cache-Control": CACHE_HEADERS,
      },
    });
  }
}

async function fallbackImage(): Promise<NextResponse> {
  try {
    const iconPath = path.join(process.cwd(), "public", "icon-512.png");
    const buf = fs.readFileSync(iconPath);
    return toJpegResponse(buf);
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) return fallbackImage();

    const docSnap = await adminDb.collection("products").doc(id).get();
    if (!docSnap.exists) return fallbackImage();

    const data = docSnap.data() || {};
    const rawImg: string =
      data.image ||
      data.imageUrl ||
      (Array.isArray(data.images) && data.images.length > 0 ? data.images[0] : "") ||
      (Array.isArray(data.gallery) && data.gallery.length > 0 ? data.gallery[0]?.url : "") ||
      "";

    if (!rawImg) return fallbackImage();

    // 1. Base64 data URL (WebP / PNG / JPEG stockée dans Firestore) -> convertie en JPEG universel pour WhatsApp/Facebook/X
    if (rawImg.startsWith("data:image/")) {
      const match = rawImg.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
      if (match) {
        const buffer = Buffer.from(match[2], "base64");
        return toJpegResponse(buffer);
      }
    }

    // 2. URL externe HTTP/HTTPS -> récupérée et convertie en JPEG direct (sans redirection 307), avec protection SSRF
    if (rawImg.startsWith("http://") || rawImg.startsWith("https://")) {
      try {
        const parsedUrl = new URL(rawImg);
        const host = parsedUrl.hostname.toLowerCase();
        const isPrivateOrLocal =
          host === "localhost" ||
          host === "127.0.0.1" ||
          host === "0.0.0.0" ||
          host === "[::1]" ||
          host.endsWith(".local") ||
          host.endsWith(".internal") ||
          /^10\./.test(host) ||
          /^192\.168\./.test(host) ||
          /^169\.254\./.test(host) ||
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);

        if (!isPrivateOrLocal && (parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:")) {
          const res = await fetch(parsedUrl.toString(), { cache: "no-store" });
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            return toJpegResponse(buf);
          }
        }
      } catch {
        // Invalid URL -> fall through to fallbackImage
      }
    }

    // 3. Fichier local dans public/ (avec protection Path Traversal)
    if (rawImg.startsWith("/")) {
      const publicDir = path.resolve(process.cwd(), "public");
      const localPath = path.resolve(publicDir, rawImg.replace(/^\/+/, ""));
      if (localPath.startsWith(publicDir + path.sep) && fs.existsSync(localPath)) {
        const buf = fs.readFileSync(localPath);
        return toJpegResponse(buf);
      }
    }

    return fallbackImage();
  } catch (error) {
    console.error("Erreur génération image OG produit:", error);
    return fallbackImage();
  }
}
