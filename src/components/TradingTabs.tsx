import type { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface TradingTabOption<TValue extends string> {
  value: TValue;
  label: ReactNode;
}

interface TradingTabsProps<TValue extends string> {
  value?: TValue;
  defaultValue?: TValue;
  tabs: TradingTabOption<TValue>[];
  onValueChange?: (value: TValue) => void;
  children?: ReactNode;
  className?: string;
  listWrapperClassName?: string;
  listClassName?: string;
  triggerClassName?: string;
  indicatorClassName?: string;
}

const TRADING_TABS_LIST_CLASS =
  "flex gap-0 p-0 bg-transparent border-b border-edge rounded-none";

const TRADING_TABS_TRIGGER_CLASS =
  "group flex-1 py-1.5 text-center text-[13px] font-medium rounded-none transition-colors duration-150 data-[state=inactive]:text-content-secondary data-[state=inactive]:hover:text-content data-[state=active]:text-content";

export function TradingTabs<TValue extends string>({
  value,
  defaultValue,
  tabs,
  onValueChange,
  children,
  className,
  listWrapperClassName,
  listClassName,
  triggerClassName,
  indicatorClassName,
}: TradingTabsProps<TValue>) {
  const tabList = (
    <TabsList
      className={cn(TRADING_TABS_LIST_CLASS, listClassName)}
      indicatorClassName={indicatorClassName}
    >
      {tabs.map((tab) => (
        <TabsTrigger
          key={tab.value}
          value={tab.value}
          className={cn(TRADING_TABS_TRIGGER_CLASS, triggerClassName)}
        >
          {tab.label}
        </TabsTrigger>
      ))}
    </TabsList>
  );

  return (
    <Tabs
      value={value}
      defaultValue={defaultValue}
      onValueChange={
        onValueChange
          ? (nextValue) => onValueChange(nextValue as TValue)
          : undefined
      }
      className={className}
    >
      {listWrapperClassName ? (
        <div className={listWrapperClassName}>{tabList}</div>
      ) : (
        tabList
      )}
      {children}
    </Tabs>
  );
}
