import * as React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

interface TabsListProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  indicatorClassName?: string
}

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, indicatorClassName, children, ...props }, ref) => {
  const listRef = useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })

  const updateIndicator = useCallback(() => {
    const list = listRef.current
    if (!list) return
    const active = list.querySelector<HTMLElement>('[data-state="active"]')
    if (!active) return
    setIndicator({
      left: active.offsetLeft,
      width: active.offsetWidth,
    })
  }, [])

  useEffect(() => {
    updateIndicator()
    const list = listRef.current
    if (!list) return

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(updateIndicator)
    const observeTabSizes = () => {
      if (!resizeObserver) return
      resizeObserver.disconnect()
      resizeObserver.observe(list)
      const triggers = list.querySelectorAll<HTMLElement>('[role="tab"]')
      triggers.forEach((trigger) => resizeObserver.observe(trigger))
    }
    observeTabSizes()

    const mutationObserver = new MutationObserver(() => {
      observeTabSizes()
      updateIndicator()
    })
    mutationObserver.observe(list, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
      attributeFilter: ['data-state'],
    })

    // Prevent macOS swipe-back gesture on horizontal overscroll
    const preventOverscroll = (e: WheelEvent) => {
      // A non-scrolling list may sit inside a scrolling wrapper.
      // Let that wrapper handle the wheel event and contain its own overscroll.
      if (list.scrollWidth <= list.clientWidth) return
      const atLeft = list.scrollLeft <= 0
      const atRight = list.scrollLeft + list.clientWidth >= list.scrollWidth - 1
      if ((atLeft && e.deltaX < 0) || (atRight && e.deltaX > 0)) {
        e.preventDefault()
      }
    }
    list.addEventListener('wheel', preventOverscroll, { passive: false })

    return () => {
      mutationObserver.disconnect()
      resizeObserver?.disconnect()
      list.removeEventListener('wheel', preventOverscroll)
    }
  }, [updateIndicator])

  return (
    <TabsPrimitive.List
      ref={(node) => {
        (listRef as React.MutableRefObject<HTMLDivElement | null>).current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
      }}
      className={cn(
        "relative flex items-center gap-0 border-b border-edge bg-tab-inactive px-0 py-0 overscroll-x-contain",
        className
      )}
      {...props}
    >
      {children}
      <div
        className={cn(
          "absolute bottom-[-1px] h-[1px] bg-content transition-all duration-200 ease-out",
          indicatorClassName,
        )}
        style={{ left: indicator.left, width: indicator.width }}
      />
    </TabsPrimitive.List>
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-none px-3 py-2 text-[12px] font-medium text-content-secondary transition-colors duration-150 hover:text-content data-[state=active]:bg-tab-active data-[state=active]:text-content",
        className
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.Trigger>
  )
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "flex-1 overflow-auto focus-visible:outline-none",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
