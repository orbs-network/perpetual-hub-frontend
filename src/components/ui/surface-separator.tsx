import { cn } from '@/lib/utils'

function SurfaceSeparator({className = '', direction = 'horizontal'}:{className?: string, direction?: 'horizontal' | 'vertical'}) {
  return (
    <div className={cn(
      'surface-separator bg-base',
      direction === 'vertical' ? 'h-full w-[4px]' : 'w-full h-[4px]',
      className
    )} />
  )
}

export default SurfaceSeparator
