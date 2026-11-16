import { useOrderForm } from "./useOrderForm";

export function useFormMarginInfo() {
  return useOrderForm().marginPayload;
}
