import { Toaster } from 'sonner';
import { CheckCircle } from 'lucide-react';
import { getThemeColorScheme } from '@/config/partners';
import { useAppliedThemeColors } from '@/hooks/useAppliedThemeColors';

export function ToastContainer() {
  const theme = useAppliedThemeColors();
  return (
    <Toaster
      position='bottom-right'
      theme={getThemeColorScheme(theme)}
      toastOptions={{
        style: {
          background: 'rgb(var(--color-surface))',
          border: '1px solid rgb(var(--color-edge))',
          color: 'rgb(var(--color-content))',
          fontSize: '13px',
        },

        className: 'font-sans app-toast',
      }}
      icons={{
        success: (
          <CheckCircle
            size={16}
            strokeWidth={2}
            fill="none"
            style={{ color: 'rgb(var(--color-long))' }}
          />
        ),
      }}
      gap={8}
      visibleToasts={1}
    />
  );
}
