import { useState } from "react";

interface AiAssistantOptions {
  onAiDataParsed: (parsedData: any) => void;
  apiEndpoint?: string;
}

export function useProductAiAssistant({ onAiDataParsed, apiEndpoint = '/api/ai/product-assistant' }: AiAssistantOptions) {
  const [chatMessages, setChatMessages] = useState<{ role: string, text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  const processAiResponse = (aiText: string, updatedMessages: { role: string, text: string }[]) => {
    let textToDisplay = aiText;
    const jsonMatch = textToDisplay.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.autoFill) {
          onAiDataParsed(parsed.autoFill);
        }
      } catch (e) {
        console.error("Erreur parsing JSON de l'IA", e);
      }
      textToDisplay = textToDisplay.replace(/```json\n[\s\S]*?\n```/, '').trim();
    }

    if (textToDisplay) {
      setChatMessages([...updatedMessages, { role: 'model', text: textToDisplay }]);
    } else if (jsonMatch) {
        // If there was JSON but no text, we just append a generic success message
        // Or we just don't append anything
    }
  };

  const analyzeImage = async (base64data: string, mimeType: string, prompt: string) => {
    setIsAiLoading(true);
    setChatMessages([]);
    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          imageBase64: base64data,
          imageMimeType: mimeType,
          history: []
        })
      });
      const data = await res.json();
      if (data.text) {
        processAiResponse(data.text, [{ role: 'user', text: 'Image ajoutée.' }]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const newMessages = [...chatMessages, { role: 'user', text: chatInput }];
    setChatMessages(newMessages);
    setChatInput("");
    setIsAiLoading(true);

    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: chatInput,
          history: newMessages.slice(0, -1)
        })
      });
      const data = await res.json();
      if (data.text) {
        processAiResponse(data.text, newMessages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const resetChat = () => {
    setChatMessages([]);
    setChatInput("");
    setIsAiLoading(false);
  };

  return {
    chatMessages,
    chatInput,
    setChatInput,
    isAiLoading,
    analyzeImage,
    handleSendMessage,
    resetChat
  };
}

import { optimizeImageToWebP, OptimizedImageResult } from "@/lib/imageOptimizer";
import toast from "react-hot-toast";

export const handleImageUploadShared = async (
  e: React.ChangeEvent<HTMLInputElement>,
  setImageFile: (file: File) => void,
  setImagePreview: (base64: string) => void,
  analyzeImage: (base64: string, type: string, prompt: string) => Promise<void>,
  prompt: string,
  onOptimized?: (stats: OptimizedImageResult) => void
) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const toastId = toast.loading("Conversion de la photo en format Web (WebP)...");

  try {
    const result = await optimizeImageToWebP(file, {
      maxWidth: 960,
      maxHeight: 960,
      quality: 0.8
    });

    setImageFile(result.file);
    setImagePreview(result.dataUrl);

    if (onOptimized) {
      onOptimized(result);
    }

    if (result.savedPercentage > 0) {
      toast.success(
        `Photo convertie en WebP : ${result.originalFormatted} ➔ ${result.compressedFormatted} (-${result.savedPercentage}% plus léger)`,
        { id: toastId, duration: 4000 }
      );
    } else {
      toast.success(`Photo prête en format WebP optimisé (${result.compressedFormatted})`, { id: toastId });
    }

    // Trigger AI assistance in background
    await analyzeImage(result.dataUrl, result.format, prompt);
  } catch (error) {
    console.error("Erreur de conversion d'image:", error);
    toast.error("Erreur lors de la préparation de l'image", { id: toastId });
  }
};
