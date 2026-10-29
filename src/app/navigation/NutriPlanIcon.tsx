import type { ReactNode, SVGProps } from 'react';

export type NutriPlanIconName = 'recipes' | 'plan' | 'import' | 'shopping' | 'pantry' | 'receipts';

const artwork: Record<NutriPlanIconName, (accent: string) => ReactNode> = {
  'recipes': (accent) => <g><path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Z" fill="currentColor" opacity=".16"/><path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Z"/><path d="M12 6v14M6 9h3M6 12h3M15 9h3M15 12h3"/><path d="M12 7v12" stroke={accent}/></g>,
  'plan': (accent) => <g><rect x="4" y="5" width="16" height="16" rx="2" fill="currentColor" opacity=".16"/><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M8 15l3 3 5-5"/><path d="M8 15l3 3 5-5" stroke={accent}/></g>,
  'import': (accent) => <g><path d="M4 14h16v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" fill="currentColor" opacity=".16"/><path d="M12 3v12M7 10l5 5 5-5M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><path d="M12 3v12M7 10l5 5 5-5" stroke={accent}/></g>,
  'shopping': (accent) => <g><path d="M6 8h15l-2 7H7Z" fill="currentColor" opacity=".16"/><path d="M3 4h2l2.2 11h11.6L21 8H5.8"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><circle cx="9" cy="20" r="1" fill={accent} stroke={accent}/><circle cx="18" cy="20" r="1" fill={accent} stroke={accent}/></g>,
  'pantry': (accent) => <g><rect x="5" y="3" width="14" height="18" rx="2" fill="currentColor" opacity=".16"/><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M12 3v18M5 12h14M9 7v2M15 7v2M9 16v2M15 16v2"/><path d="M9 7v2M15 7v2M9 16v2M15 16v2" stroke={accent}/></g>,
  'receipts': (accent) => <g><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" fill="currentColor" opacity=".16"/><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 7h6M9 11h6M9 15h3"/><path d="M9 15h3" stroke={accent}/></g>,
};

export interface NutriPlanIconProps extends SVGProps<SVGSVGElement> {
  name: NutriPlanIconName;
  active?: boolean;
  size?: number;
}

export default function NutriPlanIcon({ name, active = false, size = 22, ...props }: NutriPlanIconProps) {
  const accent = active ? 'currentColor' : 'var(--np-icon-accent, #b5ff4c)';
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={props['aria-label'] ? undefined : true} role={props['aria-label'] ? 'img' : undefined}
      focusable="false" {...props}>
      {artwork[name](accent)}
    </svg>
  );
}
