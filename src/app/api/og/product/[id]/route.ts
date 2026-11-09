import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.redirect(new URL("/supermarket-hero.jpg", _req.url));
    }

    const docSnap = await adminDb.collection("products").doc(id).get();
    if (!docSnap.exists) {
      return NextResponse.redirect(new URL("/supermarket-hero.jpg", _req.url));
    }

    const data = docSnap.data() || {};
    const rawImg: string =
      data.image ||
      data.imageUrl ||
      (Array.isArray(data.images) && data.images.length > 0 ? data.images[0] : "") ||
      (Array.isArray(data.gallery) && data.gallery.length > 0 ? data.gallery[0]?.url : "") ||
      "";

    if (!rawImg) {
      return NextResponse.redirect(new URL("/supermarket-hero.jpg", _req.url));
    }

    // Handle base64 data URL (e.g. data:image/webp;base64,...)
    if (rawImg.startsWith("data:image/")) {
      const match = rawImg.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, "base64");
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": mimeType,
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
          },
        });
      }
    }

    // Handle external HTTP/HTTPS image URL
    if (rawImg.startsWith("http://") || rawImg.startsWith("https://")) {
      return NextResponse.redirect(rawImg);
    }

    // Handle local relative path
    if (rawImg.startsWith("/")) {
      return NextResponse.redirect(new URL(rawImg, _req.url));
    }

    return NextResponse.redirect(new URL("/supermarket-hero.jpg", _req.url));
  } catch (error) {
    console.error("Erreur génération image OG produit:", error);
    return NextResponse.redirect(new URL("/supermarket-hero.jpg", _req.url));
  }
}
