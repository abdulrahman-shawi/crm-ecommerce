import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ShareWhatsAppBody = {
  whatsappNumber?: string;
  customerName?: string;
  orderNumber?: string;
  pdfBase64?: string;
  fileName?: string;
};

const normalizePhone = (input: string) => input.replace(/\D/g, "");

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ShareWhatsAppBody;
    const rawNumber = String(body.whatsappNumber || "");
    const whatsappNumber = normalizePhone(rawNumber);

    if (!whatsappNumber) {
      return NextResponse.json({ success: false, error: "رقم واتساب غير صالح" }, { status: 400 });
    }

    if (!body.pdfBase64) {
      return NextResponse.json({ success: false, error: "ملف PDF مفقود" }, { status: 400 });
    }

    const token = process.env.WHATSAPP_CLOUD_API_TOKEN || process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.WHATSAPP_API_VERSION || "v21.0";

    if (!token || !phoneNumberId) {
      return NextResponse.json(
        {
          success: false,
          error: "WhatsApp Cloud API غير مهيأ. أضف WHATSAPP_CLOUD_API_TOKEN و WHATSAPP_PHONE_NUMBER_ID",
        },
        { status: 500 }
      );
    }

    const pureBase64 = body.pdfBase64.includes(",")
      ? body.pdfBase64.split(",").pop() || ""
      : body.pdfBase64;

    const fileName = body.fileName || `order-${body.orderNumber || Date.now()}.pdf`;
    const binary = Buffer.from(pureBase64, "base64");
    const blob = new Blob([binary], { type: "application/pdf" });

    const mediaFormData = new FormData();
    mediaFormData.append("messaging_product", "whatsapp");
    mediaFormData.append("file", blob, fileName);

    const uploadRes = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: mediaFormData,
    });

    if (!uploadRes.ok) {
      const uploadError = await uploadRes.text();
      return NextResponse.json(
        { success: false, error: "فشل رفع ملف PDF إلى واتساب", details: uploadError },
        { status: 502 }
      );
    }

    const uploadData = await uploadRes.json();
    const mediaId = uploadData?.id;

    if (!mediaId) {
      return NextResponse.json({ success: false, error: "تعذر الحصول على media id" }, { status: 502 });
    }

    const caption = `مرحباً ${body.customerName || ""}، مرفق فاتورة الطلب رقم #${body.orderNumber || ""}`.trim();

    const messageRes = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: whatsappNumber,
        type: "document",
        document: {
          id: mediaId,
          filename: fileName,
          caption,
        },
      }),
    });

    if (!messageRes.ok) {
      const messageError = await messageRes.text();
      return NextResponse.json(
        { success: false, error: "فشل إرسال ملف PDF عبر واتساب", details: messageError },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ success: false, error: "خطأ داخلي أثناء مشاركة الملف" }, { status: 500 });
  }
}
