import { create } from 'zustand';

/**
 * uiStore.js
 * -----------
 * Minimal global UI state — which bottom sheet/modal is open, and a
 * simple toast queue for confirmation feedback. Business data itself
 * always lives in Dexie (source of truth); this store is purely
 * ephemeral UI state that resets on app restart by design.
 */
export const useUIStore = create((set, get) => ({
  activeSheet: null, // e.g. 'add-production' | 'add-sale' | 'add-expense' | ...
  sheetContext: null, // optional payload passed to the sheet (e.g. editing an existing record)

  openSheet: (sheetKey, context = null) => set({ activeSheet: sheetKey, sheetContext: context }),
  closeSheet: () => set({ activeSheet: null, sheetContext: null }),

  invoiceBuilderData: null,
  setInvoiceBuilderData: (data) => set({ invoiceBuilderData: data }),

  toasts: [],
  pushToast: (message, tone = 'success') => {
    const id = Date.now() + Math.random();
    set({ toasts: [...get().toasts, { id, message, tone }] });
    setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    }, 2800);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
