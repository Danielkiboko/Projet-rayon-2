import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { initFirebaseAdmin, adminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    // Clé absente ou au format Vercel chiffré (AQ.*) non déchiffré en local
    if (!apiKey || apiKey.startsWith("AQ.")) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY manquante ou invalide. Assurez-vous d'utiliser une vraie clé API Google AI (format AIzaSy...) dans .env.local." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const { logId } = await req.json();

    if (!logId) {
      return NextResponse.json({ error: "Missing logId" }, { status: 400 });
    }

    await initFirebaseAdmin();
    const db = adminDb;
    const logRef = db.collection("error_logs").doc(logId);
    const logDoc = await logRef.get();

    if (!logDoc.exists) {
      return NextResponse.json({ error: "Log not found" }, { status: 404 });
    }

    const logData = logDoc.data();

    // Use Gemini to analyze the bug
    const prompt = `
Tu es un ingénieur logiciel expert. Voici un log d'erreur provenant d'une application Next.js avec Firebase.

Message d'erreur : ${logData?.message}
Stack Trace : ${logData?.stack || "Non fourni"}
Source : ${logData?.source}
Contexte : ${logData?.context}

Analyse cette erreur et fournis une explication claire de ce qui a pu se passer, ainsi qu'une solution potentielle ou des étapes pour résoudre ce bug. Formatte ta réponse en Markdown de manière concise et facile à lire.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const analysis = response.text;

    // Save the analysis back to Firestore
    await logRef.update({
      aiAnalysis: analysis,
      status: "ANALYZED",
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true, analysis });
  } catch (error: any) {
    console.error("AI Bug Analysis failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
