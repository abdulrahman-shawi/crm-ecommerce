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

  if (Number.isInteger(campaignId) && campaignId > 0 && recipientId) {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { metrics: true },
      });

      if (campaign) {
        const metrics = normalizeMetrics(campaign.metrics);
        const key = `${recipientType}:${recipientId}`;
        if (!metrics._openedRecipients.includes(key)) {
          metrics._openedRecipients.push(key);
          metrics.opened += 1;
          await prisma.campaign.update({
            where: { id: campaignId },
            data: { metrics },
          });
        }
      }
    } catch (error) {
      console.error("Campaign open tracking error:", error);
    }
  }

  // 1x1 transparent GIF
  const pixel = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );

  return new NextResponse(pixel, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
