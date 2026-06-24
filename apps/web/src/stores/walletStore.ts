import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  walletId: string | null;
  connect: (address: string, walletId: string) => void;
  disconnect: () => void;
  setConnecting: (v: boolean) => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      address: null,
      isConnected: false,
      isConnecting: false,
      walletId: null,

      connect: (address, walletId) =>
        set({ address, isConnected: true, isConnecting: false, walletId }),

      disconnect: () =>
        set({ address: null, isConnected: false, walletId: null }),

      setConnecting: (v) => set({ isConnecting: v }),
    }),
    {
      name: 'predictfi-wallet',
      partialize: (state) => ({ address: state.address, walletId: state.walletId }),
    },
  ),
);
