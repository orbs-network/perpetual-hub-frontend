import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/lib/utils"

const Drawer = ({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    {...props}
  />
)
Drawer.displayName = "Drawer"

const DrawerTrigger = DrawerPrimitive.Trigger

const DrawerPortal = DrawerPrimitive.Portal

const DrawerClose = DrawerPrimitive.Close

const DrawerOverlay = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-overlay backdrop-blur-sm", className)}
    {...props}
  />
))
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName

const DrawerContent = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
    direction?: "bottom" | "left"
    showHandle?: boolean
    showBottomInset?: boolean
  }
>(({
  className,
  children,
  direction = "bottom",
  showHandle = true,
  showBottomInset = true,
  ...props
}, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        direction === "left"
          ? "fixed inset-y-0 left-0 z-50 flex h-full w-80 flex-col border-r border-edge bg-modal-bg"
          : "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto max-h-[calc(100dvh_-_env(safe-area-inset-top,0px))] flex-col overflow-y-auto overscroll-contain rounded-t-xl border-t border-edge bg-modal-bg",
        className
      )}
      {...props}
    >
      {direction === "bottom" && showHandle && (
        <div
          data-drawer-handle="true"
          className="mx-auto mt-3 mb-2 h-1 w-10 rounded-full bg-hover"
        />
      )}
      {children}
      {direction === "bottom" && showBottomInset && (
        <div
          data-drawer-bottom-inset="true"
          className="h-[max(1rem,env(safe-area-inset-bottom,0px))] shrink-0"
        />
      )}
    </DrawerPrimitive.Content>
  </DrawerPortal>
))
DrawerContent.displayName = "DrawerContent"

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("grid gap-1.5 px-4 pb-2 text-center sm:text-left", className)}
    {...props}
  />
)
DrawerHeader.displayName = "DrawerHeader"

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    {...props}
  />
)
DrawerFooter.displayName = "DrawerFooter"

const DrawerTitle = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, children, ...props }, ref) => {

  return (
    <DrawerPrimitive.Title
      ref={ref}
      className={cn(
        "text-lg font-semibold text-content leading-none tracking-tight",
        className
      )}
      {...props}
    >
      {children}
    </DrawerPrimitive.Title>
  )
})
DrawerTitle.displayName = DrawerPrimitive.Title.displayName

const DrawerDescription = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, children, ...props }, ref) => {

  return (
    <DrawerPrimitive.Description
      ref={ref}
      className={cn("text-sm text-content-muted", className)}
      {...props}
    >
      {children}
    </DrawerPrimitive.Description>
  )
})
DrawerDescription.displayName = DrawerPrimitive.Description.displayName

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerClose,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
