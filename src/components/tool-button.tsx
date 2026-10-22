"use client";

import { Tooltip } from "@base-ui/react/tooltip";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function ToolHints({ children }: { children: ReactNode }) {
  return <Tooltip.Provider delay={450}>{children}</Tooltip.Provider>;
}

/** Native button behavior, with supplementary labels for mouse and keyboard. */
export function ToolButton({ label, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <Tooltip.Root>
    <Tooltip.Trigger render={<button type="button" aria-label={label} {...props} />}>{children}</Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Positioner side="top" sideOffset={10} className="pixel-tooltip-positioner">
        <Tooltip.Popup className="pixel-tooltip">{label}</Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>;
}
