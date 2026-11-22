import { useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { CheckCircle, Clock3 } from 'lucide-react';
import { getThemeColorScheme } from '@/config/partners';
import { useAppliedThemeColors } from '@/hooks/useAppliedThemeColors';
import { useTranslation } from '@/hooks/useSafeTranslation';
import { useIsMobile } from '@/hooks/useIsMobile';
import { isPartnerApprovalPending } from '@/config/partners/availability';

const AVAILABILITY_TOASTER_ID = 'partner-availability';

export function ToastContainer() {
  const theme = useAppliedThemeColors();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const pending = isPartnerApprovalPending() && !isMobile;
  useEffect(() => {
    if (!pending) return;
    const id = toast.message(t('This app will be available soon'), {
      toasterId: AVAILABILITY_TOASTER_ID,
      icon: <Clock3 aria-hidden="true" size={18} className="text-accent-primary" />,
      description: t('Trading is not available yet.'),
      duration: Infinity,
      dismissible: false,
      closeButton: false,
    });
    return () => { toast.dismiss(id); };
  }, [pending, t]);

  const toastOptions = {
    style: {
      background: 'rgb(var(--color-surface))',
      border: '1px solid rgb(var(--color-edge))',
      color: 'rgb(var(--color-content))',
      fontSize: '13px',
    },
    className: 'font-sans app-toast',
  };
  return (
    <>
      {pending && <Toaster
        id={AVAILABILITY_TOASTER_ID}
        className='max-w-[calc(100vw-32px)]'
        position='top-right'
        offset={{ top: 68, right: 24 }}
        mobileOffset={{ top: 73, left: 16, right: 16 }}
        theme={getThemeColorScheme(theme)}
        toastOptions={{ ...toastOptions, style: { ...toastOptions.style, left: 'auto' } }}
      />}
      <Toaster
        position='bottom-right'
        theme={getThemeColorScheme(theme)}
        toastOptions={toastOptions}
        icons={{
          success: (
            <CheckCircle
              size={16}
              strokeWidth={2}
              fill="none"
              style={{ color: 'rgb(var(--color-up))' }}
            />
          ),
        }}
        gap={8}
        visibleToasts={1}
      />
    </>
  );
}
