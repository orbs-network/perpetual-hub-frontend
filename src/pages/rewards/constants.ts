export const REFERRAL_CODE_RE = /^[A-Z0-9_-]{1,30}$/;
export const TRADING_NOT_ENABLED_MESSAGE =
  "Enable trading before creating a referral code";

export const REFERRALS_TABLE_PAGE_SIZE = 25;
export const REFERRALS_TABLE_MIN_WIDTH = 820;
export const REFERRALS_TABLE_COLUMN_TEMPLATE =
  "minmax(220px,1.3fr) minmax(170px,1fr) repeat(3,minmax(140px,1fr))";
export const REFERRALS_TABLE_COLUMNS = [
  {
    cellClassName: "font-mono text-[12px]",
    key: "address",
    label: "Address",
  },
  {
    cellClassName: "text-content-secondary",
    key: "dateJoined",
    label: "Date Joined",
  },
  {
    cellClassName: "text-content-secondary",
    key: "totalVolume",
    label: "Total Volume",
  },
  {
    cellClassName: "text-content-secondary",
    key: "feesPaid",
    label: "Fees Paid",
  },
  {
    cellClassName: "text-content-secondary",
    key: "yourRewards",
    label: "Your Rewards",
  },
] as const;

export const REFERRALS_TABLE_SKELETON_ROWS = 8;
export const REFERRAL_SHARE_NOTE =
  "You will earn rewards when referred traders qualify.";
