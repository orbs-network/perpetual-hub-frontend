import {
  MAX_WITHDRAWAL_AMOUNT,
  MIN_WITHDRAWAL_AMOUNT,
  WITHDRAWAL_FEE_AMOUNT,
} from "@/config/constants";

export function isWithdrawalDustDrain(
  payout: bigint,
  availableBalance: bigint,
  isMax: boolean,
): boolean {
  return isMax && payout === 0n && availableBalance > 0n && availableBalance <= WITHDRAWAL_FEE_AMOUNT;
}

export function getWithdrawalFee(
  payout: bigint,
  availableBalance: bigint,
  isMax: boolean,
): bigint {
  if (isWithdrawalDustDrain(payout, availableBalance, isMax)) {
    return availableBalance;
  }
  return payout > 0n ? WITHDRAWAL_FEE_AMOUNT : 0n;
}

export function getWithdrawalTotalDebit(
  payout: bigint,
  availableBalance = 0n,
  isMax = false,
): bigint {
  const fee = getWithdrawalFee(payout, availableBalance, isMax);
  return payout > 0n || fee > 0n ? payout + fee : 0n;
}

export function getWithdrawalMaxPayout(availableBalance: bigint): bigint {
  if (availableBalance <= WITHDRAWAL_FEE_AMOUNT) return 0n;
  const feeAwareMax = availableBalance - WITHDRAWAL_FEE_AMOUNT;
  return feeAwareMax > MAX_WITHDRAWAL_AMOUNT
    ? MAX_WITHDRAWAL_AMOUNT
    : feeAwareMax;
}

export function isBelowWithdrawalMinimum(
  payout: bigint,
  availableBalance: bigint,
  isMax: boolean,
): boolean {
  if (isWithdrawalDustDrain(payout, availableBalance, isMax)) return false;
  if (payout <= 0n) return true;
  if (payout >= MIN_WITHDRAWAL_AMOUNT) return false;
  return !(isMax && payout === getWithdrawalMaxPayout(availableBalance));
}

export function isAboveWithdrawalMaximum(payout: bigint): boolean {
  return payout > MAX_WITHDRAWAL_AMOUNT;
}

export function hasEnoughForWithdrawal(
  payout: bigint,
  availableBalance: bigint,
  isMax = false,
): boolean {
  const totalDebit = getWithdrawalTotalDebit(payout, availableBalance, isMax);
  return totalDebit > 0n && totalDebit <= availableBalance;
}
