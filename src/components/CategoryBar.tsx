import { useRef } from 'react'
import { LayoutGrid } from 'lucide-react'
import { usePOS } from '../store'

export function CategoryBar() {
  const { categories, selectedCategory, setSelectedCategory } = usePOS()
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <div className="border-b border-border/40 bg-bg-card/40 flex-shrink-0">
      <div
        ref={scrollRef}
        className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* All categories */}
        <button
          onClick={() => setSelectedCategory(null)}
          className={`
            flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold
            whitespace-nowrap transition-all border flex-shrink-0
            ${selectedCategory === null
              ? 'bg-accent text-white border-accent shadow-[0_2px_12px_rgba(91,141,247,0.4)]'
              : 'bg-bg-elevated text-text-2 border-border hover:text-text-1 hover:border-border-strong hover:bg-bg-hover'
            }
          `}
        >
          <LayoutGrid className="w-3 h-3" />
          All
        </button>

        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id
          const color = cat.color || '#5B8DF7'
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(isActive ? null : cat.id)}
              style={
                isActive
                  ? {
                      backgroundColor: color,
                      borderColor: color,
                      boxShadow: `0 2px 12px ${color}55`,
                      color: '#fff',
                    }
                  : {
                      borderColor: `${color}30`,
                      color: color,
                    }
              }
              className={`
                flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold
                whitespace-nowrap transition-all border flex-shrink-0
                ${!isActive ? 'bg-bg-elevated hover:bg-bg-hover' : ''}
              `}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.7)' : color }}
              />
              {cat.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
