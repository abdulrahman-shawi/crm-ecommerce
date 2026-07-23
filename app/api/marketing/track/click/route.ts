import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function normalizeMetrics(value: any) {
  const metrics = typeof value === "object" && value !== null ? value : {};
  return {
    sent: Math.max(0, Number(metrics.sent || 0)),
    opened: Math.max(0, Number(metrics.opened || 0)),
    clicked: Math.max(0, Number(metrics.clicked || 0)),
    converted: Math.max(0, Number(metrics.converted || 0)),
    _openedRecipients: Array.isArray(metrics._openedRecipients) ? metrics._openedRecipients : [],
    _clickedRecipients: Array.isArray(metrics._clickedRecipients) ? metrics._clickedRecipients : [],
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const campaignId = Number(searchParams.get("c"));
  const recipientId = searchParams.get("u");
  const recipientType = searchParams.get("t") || "customer";
  const targetUrl = searchParams.get("url") || "/";

  if (Number.isInteger(campaignId) && campaignId > 0 && recipientId) {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { metrics: true },
      });

      if (campaign) {
        const metrics = normalizeMetrics(campaign.metrics);
        const key = `${recipientType}:${recipientId}`;
        if (!metrics._clickedRecipients.includes(key)) {
          metrics._clickedRecipients.push(key);
          metrics.clicked += 1;
          await prisma.campaign.update({
            where: { id: campaignId },
            data: { metrics },
          });
        }
      }
    } catch (error) {
      console.error("Campaign click tracking error:", error);
    }
  }

  const decodedUrl = decodeURIComponent(targetUrl);
  const safeUrl = /^\//.test(decodedUrl) || /^https?:\/\//.test(decodedUrl) ? decodedUrl : "/";

  return NextResponse.redirect(safeUrl);
}
