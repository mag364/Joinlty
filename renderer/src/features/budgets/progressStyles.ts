export const progressWidthTransitionClass = 'transition-[width] duration-200 ease-out motion-reduce:transition-none'

export const progressRailClass = 'h-2 rounded-full bg-slate-200/80'

export const progressFillClass = (ratio: number, hasTarget = true) => {
  if (!hasTarget) return 'bg-slate-400/60'
  if (ratio > 1) return 'bg-red-400'
  if (ratio >= 0.85) return 'bg-amber-400'
  return 'bg-emerald-400'
}

export const progressTextClass = (ratio: number, hasTarget = true) => {
  if (!hasTarget) return 'text-slate-400'
  if (ratio > 1) return 'text-red-600'
  if (ratio >= 0.85) return 'text-amber-600'
  return 'text-slate-500'
}
