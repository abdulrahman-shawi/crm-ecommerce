import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

export type CampaignRecipient = {
  id: string;
  email: string;
  name: string | null;
  type: "customer" | "wholesale";
};

export type CampaignEmailInput = {
  id: number;
  title: string;
  subject: string;
  content: string;
};

export function getTrackingBaseUrl() {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  return "";
}

export function buildCampaignEmailHtml(
  campaign: CampaignEmailInput,
  recipient: CampaignRecipient,
  baseUrl: string
) {
  const openUrl = `${baseUrl}/api/marketing/track/open?c=${campaign.id}&u=${encodeURIComponent(
    recipient.id
  )}&t=${recipient.type}`;
  const clickUrl = `${baseUrl}/api/marketing/track/click?c=${campaign.id}&u=${encodeURIComponent(
    recipient.id
  )}&t=${recipient.type}&url=${encodeURIComponent(baseUrl)}`;

  const safeContent = campaign.content.replace(/</g, "<").replace(/>/g, ">").replace(/\n/g, "<br/>");

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <title>${campaign.title}</title>
</head>
<body style="font-family: Arial, sans-serif; direction: rtl; text-align: right; padding: 24px; color: #1f2937;">
  <h1 style="font-size: 20px; margin-bottom: 16px;">${campaign.title}</h1>
  <div style="line-height: 1.6; margin-bottom: 24px;">
    ${safeContent}
  </div>
  <a href="${clickUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; border-radius: 8px; text-decoration: none; font-weight: bold;">
    زيارة المتجر
  </a>
  <img src="${openUrl}" width="1" height="1" alt="" style="border: 0; display: block;" />
</body>
</html>
  `.trim();
}

export async function sendCampaignEmail(
  campaign: CampaignEmailInput,
  recipient: CampaignRecipient,
  baseUrl: string
) {
  if (!process.env.RESEND_API_KEY || !resend) {
    throw new Error("RESEND_API_KEY غير مضبوط في متغيرات البيئة");
  }

  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL غير مضبوط في متغيرات البيئة");
  }

  const html = buildCampaignEmailHtml(campaign, recipient, baseUrl);

  return resend.emails.send({
    from: FROM_EMAIL,
    to: recipient.email,
    subject: campaign.subject || campaign.title,
    html,
  });
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}
