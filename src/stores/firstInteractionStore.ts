import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Hex } from "viem";
import { TERMS_ACCEPTANCE_VERSION } from "@/lib/termsAcceptance";

interface TermsAcceptanceRecord {
  address: string;
  chainId: number;
  signature: Hex;
  termsVersion: string;
  timestamp: number;
}

interface FirstInteractionState {
  termsAcceptances: Record<string, TermsAcceptanceRecord>;
  firstEnableDepositPromptShown: Record<string, true>;
  hasAcceptedTerms: (address?: string) => boolean;
  markTermsAccepted: (
    record: Omit<TermsAcceptanceRecord, "termsVersion">,
  ) => void;
  shouldShowFirstEnableDepositPrompt: (address?: string) => boolean;
  markFirstEnableDepositPromptShown: (address?: string) => void;
}

function normalizeAddress(address?: string) {
  return address?.toLowerCase() ?? "";
}

export function hasAcceptedTermsInState(
  records: Record<string, TermsAcceptanceRecord>,
  address?: string,
) {
  const key = normalizeAddress(address);
  if (!key) return false;

  const record = records[key];
  return (
    record?.address === key &&
    record.termsVersion === TERMS_ACCEPTANCE_VERSION &&
    !!record.signature
  );
}

export const firstInteractionInitialState = {
  termsAcceptances: {},
  firstEnableDepositPromptShown: {},
};

export const useFirstInteractionStore = create<FirstInteractionState>()(
  persist(
    (set, get) => ({
      ...firstInteractionInitialState,
      hasAcceptedTerms: (address?: string) =>
        hasAcceptedTermsInState(get().termsAcceptances, address),
      markTermsAccepted: (record) => {
        const key = normalizeAddress(record.address);
        if (!key) return;

        set((state) => ({
          termsAcceptances: {
            ...state.termsAcceptances,
            [key]: {
              ...record,
              address: key,
              termsVersion: TERMS_ACCEPTANCE_VERSION,
            },
          },
        }));
      },
      shouldShowFirstEnableDepositPrompt: (address?: string) => {
        const key = normalizeAddress(address);
        return !!key && !get().firstEnableDepositPromptShown[key];
      },
      markFirstEnableDepositPromptShown: (address?: string) => {
        const key = normalizeAddress(address);
        if (!key) return;

        set((state) => ({
          firstEnableDepositPromptShown: {
            ...state.firstEnableDepositPromptShown,
            [key]: true,
          },
        }));
      },
    }),
    {
      name: "first-interactions",
      partialize: (state) => ({
        termsAcceptances: state.termsAcceptances,
        firstEnableDepositPromptShown: state.firstEnableDepositPromptShown,
      }),
    },
  ),
);
