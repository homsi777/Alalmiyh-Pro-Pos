
import { create } from 'zustand';
import { CartItem, Currency, Product, Price } from '../types';

interface PosState {
  items: CartItem[];
  currency: Currency;
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateItemPrice: (productId: string, newPrice: Price) => void;
  setCurrency: (currency: Currency) => void;
  clearCart: () => void;
}

const usePosStore = create<PosState>((set) => ({
  items: [],
  currency: Currency.SYP,
  addItem: (product) =>
    set((state) => {
      const existingItem = state.items.find((item) => item.product.id === product.id);
      if (existingItem) {
        return {
          items: state.items.map((item) =>
            item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
          ),
        };
      }
      return { items: [...state.items, { product, quantity: 1 }] };
    }),
  removeItem: (productId) =>
    set((state) => ({
      items: state.items.filter((item) => item.product.id !== productId),
    })),
  updateQuantity: (productId, quantity) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.product.id === productId ? { ...item, quantity: Math.max(0, quantity) } : item
      ),
    })),
  updateItemPrice: (productId, newPrice) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.product.id === productId ? { ...item, overridePrice: newPrice } : item
      ),
    })),
  setCurrency: (currency) => set({ currency }),
  clearCart: () => set({ items: [], currency: Currency.SYP }),
}));

export default usePosStore;