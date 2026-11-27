import { enforceRateLimit } from "@/lib/rateLimit";
import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getServerCaller } from '@/lib/serverAuth';

export async function POST(req: Request) {
  try {
  const _rl = await enforceRateLimit(req, "api:ai_product-assistant:POST", 12, 60);
  if (_rl) return _rl;
    const caller = await getServerCaller(req);
    if (!caller) {
      return NextResponse.json({ error: 'Authentification requise pour utiliser l\'assistant IA.' }, { status: 401 });
    }

    const { message, history, imageBase64, imageMimeType } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Clé API Gemini non configurée.' }, { status: 500 });
    }
    
    // Initialize inside the request to ensure env variables are loaded properly
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const systemInstruction = `Tu es un assistant expert pour Rayon, une plateforme e-commerce. 
Ton rôle est d'aider les fournisseurs à créer de bonnes descriptions pour leurs produits et de valider les photos qu'ils uploadent.
- Analyse TOUJOURS la photo fournie. Si elle est floue, mal cadrée, de mauvaise qualité ou trop sombre, dis-le clairement et suggère d'utiliser le bouton "Supprimer et changer d'image".
- VÉRIFIE que la photo correspond bien à ce qui est discuté ou à un produit vendable. Si ce n'est pas cohérent (ex: on te parle d'une montre mais la photo montre une chaise, ou la photo ne montre aucun produit clair), signale-le au fournisseur !
- Pose des questions courtes (une par une) pour obtenir les infos du produit (nom, prix, catégorie, stock, description).
- QUAND TU AS ASSEZ D'INFOS (au moins un nom et une description), tu DOIS inclure un bloc JSON dans ta réponse exactement sous ce format pour remplir automatiquement le formulaire du fournisseur (la valeur "category" DOIT IMPÉRATIVEMENT être "mode" pour les vêtements/chaussures/mode, "connect" pour l'électronique/télécom/tech, "immo" pour l'immobilier/hôtel, ou "general" pour le reste) :
\`\`\`json
{
  "autoFill": {
    "title": "Nom du produit",
    "price": "15000",
    "stock": "10",
    "category": "mode",
    "description": "Description détaillée générée par tes soins."
  }
}
\`\`\`
- Continue d'être naturel et encourageant dans le reste de ton texte.`;

    const formattedHistory = (history || []).map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    // If an image is provided in the current turn, add it to the user's message parts
    const currentMessageParts: any[] = [];
    if (imageBase64 && imageMimeType) {
      // @google/genai expects inlineData
      currentMessageParts.push({
        inlineData: {
          data: imageBase64.split(',')[1] || imageBase64, // Remove data URI prefix if present
          mimeType: imageMimeType,
        },
      });
    }
    
    if (message) {
      currentMessageParts.push({ text: message });
    }

    // Call the model
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        ...formattedHistory,
        {
          role: 'user',
          parts: currentMessageParts,
        }
      ],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    return NextResponse.json({ 
      text: response.text 
    });

  } catch (error: any) {
    console.error('Erreur API Gemini:', error);
    return NextResponse.json({ error: error.message || 'Une erreur est survenue avec l\'IA.' }, { status: 500 });
  }
}
