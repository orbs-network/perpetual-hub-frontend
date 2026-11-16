import {
  type Campaign,
  type CampaignPoint,
  type CampaignStatus,
  type CampaignUserPointsResponse,
} from "@/api/campaigns";
import { formatNumber } from "@/utils/formatting";

const CAMPAIGN_STATUS_ORDER: Record<CampaignStatus, number> = {
  active: 0,
  paused: 1,
  ended: 2,
  draft: 3,
};

const VISIBLE_CAMPAIGN_STATUSES = new Set<CampaignStatus>([
  "active",
  "paused",
  "ended",
]);

const UTC_DAY_FORMAT = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const UTC_DAY_YEAR_FORMAT = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

type MetadataRecord = Record<string, unknown>;

export type CampaignPointsEntry = {
  campaign: Campaign;
  userPoints: CampaignUserPointsResponse;
};

export type CampaignPointPeriodRow = {
  periodEndMs: number;
  periodLabel: string;
  periodStartMs: number;
  points: bigint;
  referralPoints: bigint;
};

function isRecord(value: unknown): value is MetadataRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function campaignParameters(campaign: Campaign) {
  const metadata = campaign.metadata;
  if (!isRecord(metadata)) return undefined;
  return isRecord(metadata.parameters) ? metadata.parameters : metadata;
}

export function getCampaignChainId(campaign: Campaign) {
  const parameters = campaignParameters(campaign);
  const rawChainId = parameters?.chainId;
  if (typeof rawChainId === "number" && Number.isInteger(rawChainId)) {
    return rawChainId;
  }
  if (typeof rawChainId === "string" && rawChainId.trim()) {
    const parsed = Number(rawChainId);
    return Number.isInteger(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function isCampaignVisibleOnChain(campaign: Campaign, chainId: number) {
  return (
    VISIBLE_CAMPAIGN_STATUSES.has(campaign.status) &&
    getCampaignChainId(campaign) === chainId
  );
}

export function sortCampaigns(left: Campaign, right: Campaign) {
  const statusDelta =
    CAMPAIGN_STATUS_ORDER[left.status] - CAMPAIGN_STATUS_ORDER[right.status];
  if (statusDelta !== 0) return statusDelta;
  return right.startMs - left.startMs;
}

export function parseInteger(value?: string | number | bigint | null) {
  if (value === undefined || value === null || value === "") return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

export function formatInteger(value?: string | number | bigint | null) {
  return formatNumber(parseInteger(value), { decimalScale: 0 }) || "0";
}

export function calculateReferralPoints(epoch: CampaignPoint) {
  const referralScore = (epoch.depths ?? []).reduce(
    (sum, depth) =>
      depth.depth > 0 ? sum + parseInteger(depth.weightedScore) : sum,
    0n,
  );
  if (referralScore <= 0n) return 0n;

  const points = parseInteger(epoch.points);
  if (points <= 0n) return 0n;

  const totalDepthScore = (epoch.depths ?? []).reduce(
    (sum, depth) => sum + parseInteger(depth.weightedScore),
    0n,
  );
  const score = parseInteger(epoch.score) || totalDepthScore;
  if (score <= 0n) return 0n;

  return (points * referralScore) / score;
}

function isSameUtcDate(left: Date, right: Date) {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

export function formatCampaignPeriod(startMs: number, endMs: number) {
  const startDate = new Date(startMs);
  const endDate = new Date(endMs > startMs ? endMs : startMs);

  if (isSameUtcDate(startDate, endDate)) {
    return UTC_DAY_YEAR_FORMAT.format(startDate);
  }

  if (startDate.getUTCFullYear() === endDate.getUTCFullYear()) {
    return `${UTC_DAY_FORMAT.format(startDate)} - ${UTC_DAY_YEAR_FORMAT.format(endDate)}`;
  }

  return `${UTC_DAY_YEAR_FORMAT.format(startDate)} - ${UTC_DAY_YEAR_FORMAT.format(endDate)}`;
}

export function buildCampaignPeriodRows(
  entries: CampaignPointsEntry[],
): CampaignPointPeriodRow[] {
  const rowsByPeriod = new Map<string, CampaignPointPeriodRow>();

  for (const { campaign, userPoints } of entries) {
    for (const epoch of userPoints.epochs) {
      const periodStartMs = campaign.startMs + epoch.epoch * campaign.epochDurationMs;
      const periodEndMs = periodStartMs + campaign.epochDurationMs;
      const periodKey = `${periodStartMs}:${periodEndMs}`;
      const row = rowsByPeriod.get(periodKey) ?? {
        periodEndMs,
        periodLabel: formatCampaignPeriod(periodStartMs, periodEndMs),
        periodStartMs,
        points: 0n,
        referralPoints: 0n,
      };

      row.points += parseInteger(epoch.points);
      row.referralPoints += calculateReferralPoints(epoch);
      rowsByPeriod.set(periodKey, row);
    }
  }

  return [...rowsByPeriod.values()].sort((left, right) => {
    const periodDelta = left.periodStartMs - right.periodStartMs;
    if (periodDelta !== 0) return periodDelta;
    return left.periodEndMs - right.periodEndMs;
  });
}
