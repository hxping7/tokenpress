import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface LayoutState {
  view: 'grid' | 'list'
  setView: (view: 'grid' | 'list') => void
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      view: 'grid',
      setView: (view) => set({ view }),
    }),
    {
      name: 'token00-layout',
    }
  )
)
