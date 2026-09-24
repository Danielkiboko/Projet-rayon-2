import { NextResponse } from "next/server";
import { sendMobiShastraSMS } from "@/lib/sms";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, message, senderId, customSenderId, supplierId, userId } = body;

    if (!phone || !message) {
      return NextResponse.json(
        { success: false, error: "Phone number and message are required" },
        { status: 400 }
      );
    }

    let resolvedSenderId = customSenderId || senderId;

    // Check if supplierId or userId is provided to lookup custom senderId
    const targetUid = supplierId || userId;
    if (!resolvedSenderId && targetUid) {
      try {
        const uDoc = await adminDb.collection("users").doc(targetUid).get();
        if (uDoc.exists) {
          const uData = uDoc.data();
          resolvedSenderId = uData?.senderId || uData?.customSenderId || uData?.smsSenderId;
          if (!resolvedSenderId && (
            uData?.displayName?.toLowerCase().includes("mutamulis") ||
            uData?.displayName?.toLowerCase().includes("laurent") ||
            uData?.email === "sumaililaurent4@gmail.com"
          )) {
            resolvedSenderId = "MUTAMULIS";
          } else if (!resolvedSenderId && (uData?.company || uData?.agencyName || uData?.companyName)) {
            resolvedSenderId = (uData.company || uData.agencyName || uData.companyName).replace(/[^a-zA-Z0-9]/g, "").slice(0, 11);
          }
        }
      } catch (err) {
        console.warn("Could not lookup senderId for target:", err);
      }
    }

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
