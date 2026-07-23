"use server";

import { decrypt } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasAnyPermission, hasPermission, isAdmin } from "@/lib/utils";
import { cookies } from "next/headers";

const CAMPAIGN_TYPES = ["EMAIL", "SOCIAL", "SMS", "CONTENT"] as const;
const CAMPAIGN_STATUSES = ["DRAFT", "SCHEDULED", "RUNNING", "COMPLETED", "CANCELLED"] as const;
const CAMPAIGN_AUDIENCES = ["ALL_CUSTOMERS", "ALL_WHOLESALE", "CUSTOM"] as const;
const METRIC_KEYS = ["sent", "opened", "clicked", "converted"] as const;

type CampaignType = (typeof CAMPAIGN_TYPES)[number];
type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
type CampaignAudience = (typeof CAMPAIGN_AUDIENCES)[number];
type MetricKey = (typeof METRIC_KEYS)[number];

async function getCurrentSessionUser() {
  try {
    const session = cookies().get("skynova")?.value;
    if (!session) return null;

    const decoded = await decrypt(session);
    if (!decoded?.userId) return null;

    return await prisma.user.findUnique({
      where: { id: String(decoded.userId) },
      include: { permission: true },
    });
  } catch {
    return null;
  }
}

function canViewMarketing(user: any) {
  if (!user) return false;
  return hasAnyPermission(user, ["viewMarketing", "addMarketing", "editMarketing", "deleteMarketing"]);
}

function canAddMarketing(user: any) {
  if (!user) return false;
  return isAdmin(user) || hasPermission(user, "addMarketing");
}

function canEditMarketing(user: any) {
  if (!user) return false;
  return isAdmin(user) || hasPermission(user, "editMarketing");
}

function canDeleteMarketing(user: any) {
  if (!user) return false;
  return isAdmin(user) || hasPermission(user, "deleteMarketing");
}

function parseOptionalDate(value: any) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function normalizeMetrics(value: any) {
  const base = { sent: 0, opened: 0, clicked: 0, converted: 0 };
  if (!value || typeof value !== "object") return base;
  const metrics = value as Record<string, any>;
  return {
    sent: Math.max(0, Number(metrics.sent || 0)),
    opened: Math.max(0, Number(metrics.opened || 0)),
    clicked: Math.max(0, Number(metrics.clicked || 0)),
    converted: Math.max(0, Number(metrics.converted || 0)),
  };
}

function parseTargetIds(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }
  return [];
}

function parseCampaignType(value: any): CampaignType | null {
  const normalized = String(value || "").toUpperCase() as CampaignType;
  return CAMPAIGN_TYPES.includes(normalized) ? normalized : null;
}

function parseCampaignStatus(value: any): CampaignStatus | null {
  const normalized = String(value || "").toUpperCase() as CampaignStatus;
  return CAMPAIGN_STATUSES.includes(normalized) ? normalized : null;
}

function parseCampaignAudience(value: any): CampaignAudience | null {
  const normalized = String(value || "").toUpperCase() as CampaignAudience;
  return CAMPAIGN_AUDIENCES.includes(normalized) ? normalized : null;
}

const campaignSelect = {
  id: true,
  title: true,
  type: true,
  status: true,
  subject: true,
  content: true,
  channelDetails: true,
  audience: true,
  targetIds: true,
  scheduledAt: true,
  sentAt: true,
  metrics: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      username: true,
    },
  },
} as const;

export async function getCampaigns() {
  const currentUser = await getCurrentSessionUser();
  if (!canViewMarketing(currentUser)) {
    return { success: false, error: "غير مصرح لك بعرض الحملات التسويقية" };
  }

  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    select: campaignSelect,
  });

  return { success: true, data: campaigns };
}

export async function getCampaignById(id: string | number) {
  const currentUser = await getCurrentSessionUser();
  if (!canViewMarketing(currentUser)) {
    return { success: false, error: "غير مصرح لك بعرض الحملات التسويقية" };
  }

  const campaignId = Number(id);
  if (!Number.isInteger(campaignId) || campaignId <= 0) {
    return { success: false, error: "معرف الحملة غير صالح" };
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: campaignSelect,
  });

  if (!campaign) {
    return { success: false, error: "الحملة غير موجودة" };
  }

  return { success: true, data: campaign };
}

export async function createCampaign(data: any) {
  try {
    const currentUser = await getCurrentSessionUser();
    if (!currentUser || !canAddMarketing(currentUser)) {
      return { success: false, error: "لا تملك صلاحية إنشاء حملة تسويقية" };
    }

    const type = parseCampaignType(data?.type);
    if (!type) {
      return { success: false, error: "يرجى اختيار نوع الحملة" };
    }

    const title = String(data?.title || "").trim();
    if (!title) {
      return { success: false, error: "يرجى إدخال عنوان الحملة" };
    }

    const content = String(data?.content || "").trim();
    if (!content) {
      return { success: false, error: "يرجى إدخال محتوى الحملة" };
    }

    const audience = parseCampaignAudience(data?.audience) || "ALL_CUSTOMERS";
    const targetIds = audience === "CUSTOM" ? parseTargetIds(data?.targetIds) : [];
    const scheduledAt = parseOptionalDate(data?.scheduledAt);
    const status = parseCampaignStatus(data?.status) || "DRAFT";

    const campaign = await prisma.campaign.create({
      data: {
        title,
        type,
        status,
        subject: type === "EMAIL" ? String(data?.subject || "").trim() : null,
        content,
        channelDetails: data?.channelDetails || {},
        audience,
        targetIds,
        scheduledAt,
        metrics: { sent: 0, opened: 0, clicked: 0, converted: 0 },
        createdById: currentUser.id,
      },
      select: campaignSelect,
    });

    return { success: true, data: campaign };
  } catch (error: any) {
    console.error("Create campaign error:", error);
    return { success: false, error: "فشل في إنشاء الحملة التسويقية" };
  }
}

export async function updateCampaign(id: string | number, data: any) {
  try {
    const currentUser = await getCurrentSessionUser();
    if (!currentUser || !canEditMarketing(currentUser)) {
      return { success: false, error: "لا تملك صلاحية تعديل الحملة التسويقية" };
    }

    const campaignId = Number(id);
    if (!Number.isInteger(campaignId) || campaignId <= 0) {
      return { success: false, error: "معرف الحملة غير صالح" };
    }

    const existing = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true },
    });

    if (!existing) {
      return { success: false, error: "الحملة غير موجودة" };
    }

    const updateData: any = {};

    if (data?.title !== undefined) updateData.title = String(data.title).trim();
    if (data?.content !== undefined) updateData.content = String(data.content).trim();
    if (data?.channelDetails !== undefined) updateData.channelDetails = data.channelDetails;
    if (data?.scheduledAt !== undefined) updateData.scheduledAt = parseOptionalDate(data.scheduledAt);
    if (data?.targetIds !== undefined) {
      const audience = parseCampaignAudience(data?.audience) || "ALL_CUSTOMERS";
      updateData.targetIds = audience === "CUSTOM" ? parseTargetIds(data.targetIds) : [];
    }

    const type = parseCampaignType(data?.type);
    if (type) {
      updateData.type = type;
      updateData.subject = type === "EMAIL" ? String(data?.subject || "").trim() : null;
    } else if (data?.subject !== undefined) {
      updateData.subject = String(data.subject).trim();
    }

    const audience = parseCampaignAudience(data?.audience);
    if (audience) {
      updateData.audience = audience;
      if (audience !== "CUSTOM") updateData.targetIds = [];
    }

    const status = parseCampaignStatus(data?.status);
    if (status) updateData.status = status;

    if (data?.metrics !== undefined) {
      updateData.metrics = normalizeMetrics(data.metrics);
    }

    const campaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: updateData,
      select: campaignSelect,
    });

    return { success: true, data: campaign };
  } catch (error: any) {
    console.error("Update campaign error:", error);
    return { success: false, error: "فشل في تعديل الحملة التسويقية" };
  }
}

export async function deleteCampaign(id: string | number) {
  try {
    const currentUser = await getCurrentSessionUser();
    if (!currentUser || !canDeleteMarketing(currentUser)) {
      return { success: false, error: "لا تملك صلاحية حذف الحملة التسويقية" };
    }

    const campaignId = Number(id);
    if (!Number.isInteger(campaignId) || campaignId <= 0) {
      return { success: false, error: "معرف الحملة غير صالح" };
    }

    await prisma.campaign.delete({
      where: { id: campaignId },
    });

    return { success: true };
  } catch (error: any) {
    console.error("Delete campaign error:", error);
    return { success: false, error: "فشل في حذف الحملة التسويقية" };
  }
}

export async function launchCampaign(id: string | number) {
  try {
    const currentUser = await getCurrentSessionUser();
    if (!currentUser || !canEditMarketing(currentUser)) {
      return { success: false, error: "لا تملك صلاحية إطلاق الحملة التسويقية" };
    }

    const campaignId = Number(id);
    if (!Number.isInteger(campaignId) || campaignId <= 0) {
      return { success: false, error: "معرف الحملة غير صالح" };
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, status: true, scheduledAt: true },
    });

    if (!campaign) {
      return { success: false, error: "الحملة غير موجودة" };
    }

    const now = new Date();
    const scheduledAt = campaign.scheduledAt ? new Date(campaign.scheduledAt) : null;
    const nextStatus = scheduledAt && scheduledAt > now ? "SCHEDULED" : "RUNNING";

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: nextStatus,
        sentAt: nextStatus === "RUNNING" ? now : null,
      },
      select: campaignSelect,
    });

    return { success: true, data: updated };
  } catch (error: any) {
    console.error("Launch campaign error:", error);
    return { success: false, error: "فشل في إطلاق الحملة التسويقية" };
  }
}

export async function recordCampaignMetric(id: string | number, metricKey: MetricKey, delta: number) {
  try {
    const currentUser = await getCurrentSessionUser();
    if (!currentUser || !canEditMarketing(currentUser)) {
      return { success: false, error: "لا تملك صلاحية تحديث مقاييس الحملة" };
    }

    const campaignId = Number(id);
    if (!Number.isInteger(campaignId) || campaignId <= 0) {
      return { success: false, error: "معرف الحملة غير صالح" };
    }

    if (!METRIC_KEYS.includes(metricKey)) {
      return { success: false, error: "مقياس غير صالح" };
    }

    const deltaValue = Math.max(0, Math.round(Number(delta || 0)));
    if (deltaValue === 0) {
      return { success: true };
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { metrics: true },
    });

    if (!campaign) {
      return { success: false, error: "الحملة غير موجودة" };
    }

    const metrics = normalizeMetrics(campaign.metrics);
    metrics[metricKey] += deltaValue;

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { metrics },
    });

    return { success: true, metrics };
  } catch (error: any) {
    console.error("Record campaign metric error:", error);
    return { success: false, error: "فشل في تحديث المقياس" };
  }
}

export async function getMarketingAnalytics() {
  const currentUser = await getCurrentSessionUser();
  if (!canViewMarketing(currentUser)) {
    return { success: false, error: "غير مصرح لك بعرض التحليلات" };
  }

  try {
    const campaigns = await prisma.campaign.findMany({
      select: {
        id: true,
        type: true,
        status: true,
        metrics: true,
        createdAt: true,
      },
    });

    const totals = campaigns.reduce(
      (acc, campaign) => {
        const metrics = normalizeMetrics(campaign.metrics);
        acc.total += 1;
        acc.sent += metrics.sent;
        acc.opened += metrics.opened;
        acc.clicked += metrics.clicked;
        acc.converted += metrics.converted;
        return acc;
      },
      { total: 0, sent: 0, opened: 0, clicked: 0, converted: 0 }
    );

    const byType = campaigns.reduce((acc: Record<string, number>, campaign) => {
      acc[campaign.type] = (acc[campaign.type] || 0) + 1;
      return acc;
    }, {});

    const byStatus = campaigns.reduce((acc: Record<string, number>, campaign) => {
      acc[campaign.status] = (acc[campaign.status] || 0) + 1;
      return acc;
    }, {});

    const topCampaigns = [...campaigns]
      .sort((a, b) => {
        const aMetrics = normalizeMetrics(a.metrics);
        const bMetrics = normalizeMetrics(b.metrics);
        return bMetrics.converted * 10 + bMetrics.clicked - (aMetrics.converted * 10 + aMetrics.clicked);
      })
      .slice(0, 5)
      .map((campaign) => ({
        id: campaign.id,
        title: "", // title is not selected in this query for performance
        type: campaign.type,
        status: campaign.status,
        metrics: normalizeMetrics(campaign.metrics),
      }));

    return { success: true, data: { totals, byType, byStatus, topCampaigns } };
  } catch (error: any) {
    console.error("Marketing analytics error:", error);
    return { success: false, error: "فشل في جلب التحليلات" };
  }
}

export async function getMarketingCampaignsByType(type: CampaignType) {
  return getCampaigns();
}
