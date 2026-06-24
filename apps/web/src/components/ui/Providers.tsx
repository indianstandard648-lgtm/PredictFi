'use client';

import { Toaster } from 'react-hot-toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#101010',
            color: '#fff',
            border: '1px solid #2A2A2A',
            borderRadius: '12px',
          },
          success: { iconTheme: { primary: '#00D4AA', secondary: '#050505' } },
          error: { iconTheme: { primary: '#FF4757', secondary: '#050505' } },
        }}
      />
    </>
  );
}
