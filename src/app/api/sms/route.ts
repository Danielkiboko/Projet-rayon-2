import { NextResponse } from "next/server";
import { sendMobiShastraSMS } from "@/lib/sms";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = body.phone || body.to || body.mobileNo;
    const { message, senderId, customSenderId, supplierId, userId } = body;

    if (!phone || !message) {
      return NextResponse.json(
        { success: false, error: "Phone number and message are required" },
        { status: 400 }
      );
    }

    let rawSenderId = customSenderId || senderId;

    // Check if supplierId or userId is provided to lookup custom senderId
    const targetUid = supplierId || userId;
    if (!rawSenderId && targetUid) {
      try {
        const uDoc = await adminDb.collection("users").doc(targetUid).get();
        if (uDoc.exists) {
          const uData = uDoc.data();
          rawSenderId = uData?.senderId || uData?.customSenderId || uData?.smsSenderId || uData?.agencyName || uData?.company || uData?.shopName;
          if (!rawSenderId && (
            uData?.displayName?.toLowerCase().includes("mutamulis") ||
            uData?.displayName?.toLowerCase().includes("laurent") ||
            uData?.email === "sumaililaurent4@gmail.com"
          )) {
            rawSenderId = "MUTAMULIS";
          }
        }

        // If still not found, check suppliers collection
        if (!rawSenderId) {
          const sDoc = await adminDb.collection("suppliers").doc(targetUid).get();
          if (sDoc.exists) {
            const sData = sDoc.data();
            rawSenderId = sData?.senderId || sData?.customSenderId || sData?.smsSenderId || sData?.agencyName || sData?.company || sData?.shopName;
          }
        }
      } catch (err) {
        console.warn("Could not lookup senderId for target:", err);
      }
    }

    // Sanitize senderId for SMS gateways (alphanumeric, max 11 chars)
    let resolvedSenderId = rawSenderId 
      ? rawSenderId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 11) 
      : undefined;

    // Call our server-side utility to send the SMS
    const result = await sendMobiShastraSMS({
      mobileNo: phone,
      message: message,
      customSenderId: resolvedSenderId,
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("SMS API Route Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send SMS" },
      { status: 500 }
    );
  }
}
