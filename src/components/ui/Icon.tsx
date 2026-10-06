import { PATHS, type IconName } from "./icon-paths";

export { iconPath, type IconName } from "./icon-paths";

/** Ölçü valideyn elementdən gəlir (width/height 100%), rəng — currentColor. */
export function Icon({ name, className, strokeWidth = 2 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "block h-full w-full"}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
