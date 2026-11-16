import { OrderFormContext } from "@/context/order-form/Context";
import { useContext } from "react";

export function useOrderForm() {
  const context = useContext(OrderFormContext);
  if (!context) {
    throw new Error("useFormContext must be used within a OrderFormProvider");
  }
  return context;
}