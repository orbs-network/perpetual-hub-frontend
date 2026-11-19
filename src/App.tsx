import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { QueryParamProvider } from "use-query-params";
import { useConfig, WagmiProvider } from "wagmi";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { Loader2 } from "lucide-react";
import "@rainbow-me/rainbowkit/styles.css";
import { ToastContainer } from "./components/ToastContainer";
import { toast } from "sonner";
import { useTranslation } from "./hooks/useSafeTranslation";
import { consumeWalletResetNotice, shouldReconnectWallet, watchExplicitWalletConnections, watchWalletAccountChanges } from "./lib/walletDisconnect";
import { useAuth } from "./hooks/useAuth";
import { TradingPage } from "./pages/TradingPage";
import { AuthGuard } from "./components/AuthGuard";
import { Header } from "./components/Header";
import { AppHeaderShell, AppShell } from "./components/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { TermsAcceptanceModal } from "./components/TermsAcceptanceModal";
import { ServerUnavailableBanner } from "./components/ServerUnavailableBanner";

// Lazy-loaded pages (not needed on initial load)
const RollupExplorerPage = lazy(() =>
  import("./pages/RollupExplorerPage").then((m) => ({
    default: m.RollupExplorerPage,
  })),
);
const RollupDetailPage = lazy(() =>
  import("./pages/RollupDetailPage").then((m) => ({
    default: m.RollupDetailPage,
  })),
);
const PortfolioPage = lazy(() =>
  import("./pages/PortfolioPage").then((m) => ({ default: m.PortfolioPage })),
);
const RewardsPage = lazy(() =>
  import("./pages/RewardsPage").then((m) => ({ default: m.RewardsPage })),
);
const PointsPage = lazy(() =>
  import("./pages/PointsPage").then((m) => ({ default: m.PointsPage })),
);
import { isPartnerApprovalPending } from './config/partners/availability';
import { wagmiConfig } from "./config/wagmi";
import { getThemeColorScheme, partner } from "./config/partners";
import { useAppliedThemeColors } from "./hooks/useAppliedThemeColors";
import Footer from "./components/Footer";
import { ReactRouterQueryParamAdapter } from "./lib/reactRouterQueryParamAdapter";
import { DEFAULT_TRADE_SYMBOL } from "./config/constants";
import { usePath } from "./hooks/useNavigation";
import { appRoutes, ROUTE_PATHS } from "./routes";
import { usePreventIosSwipeNavigation } from "./hooks/usePreventIosSwipeNavigation";
import { usePreventMobileInputFocusZoom } from "./hooks/usePreventMobileInputFocusZoom";
import {
  getCanonicalAppChainSearch,
  getPartnerChainIds,
} from "./utils/config";
import { useCurrentPartnerChainKey } from "./hooks/useCurrentPartnerChain";


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

function RedirectToDefaultTrade() {
  const path = usePath(appRoutes.trade(DEFAULT_TRADE_SYMBOL));
  return <Navigate to={path} replace />;
}

function AppChainQueryParamNormalizer() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const canonical = getCanonicalAppChainSearch({
      chainIds: getPartnerChainIds(partner.chains),
      search: location.search,
    });
    if (canonical.isCanonical) {
      return;
    }

    navigate(
      `${location.pathname}${canonical.search}${location.hash}`,
      { replace: true },
    );
  }, [location.hash, location.pathname, location.search, navigate]);

  return null;
}

function RuntimeSelectionCacheReset() {
  const queryClient = useQueryClient();
  const partnerChainKey = useCurrentPartnerChainKey();
  const previousKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const nextKey = partnerChainKey;
    if (previousKeyRef.current === null) {
      previousKeyRef.current = nextKey;
      return;
    }
    if (previousKeyRef.current === nextKey) {
      return;
    }

    previousKeyRef.current = nextKey;
    void queryClient.resetQueries();
  }, [partnerChainKey, queryClient]);

  return null;
}

function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <ErrorBoundary resetKey={`${location.pathname}${location.search}`}>
      {children}
    </ErrorBoundary>
  );
}

const Listeners = () => {
  usePreventIosSwipeNavigation();
  usePreventMobileInputFocusZoom();

  return null;
};

function WalletConnectionRecovery() {
  const config = useConfig();
  const { logout } = useAuth();
  useEffect(() => watchExplicitWalletConnections(config), [config]);
  useEffect(() => watchWalletAccountChanges(config, logout), [config, logout]);
  return null;
}

function App() {
  const { t } = useTranslation();
  const theme = useAppliedThemeColors();
  const isLight = getThemeColorScheme(theme) === "light";
  const walletTheme = (isLight ? lightTheme : darkTheme)({
    accentColor: theme["button-primary"],
    accentColorForeground: theme["content-inverse"],
    borderRadius: "small",
  });
  if (isLight) {
    Object.assign(walletTheme.colors, {
      modalBackground: theme["modal-bg"],
      modalText: theme.content,
      modalTextSecondary: theme["content-secondary"],
      modalTextDim: theme["content-muted"],
      modalBackdrop: theme.overlay,
      modalBorder: theme.edge,
      generalBorder: theme.edge,
      generalBorderDim: theme["edge-subtle"],
      menuItemBackground: theme.hover,
      actionButtonSecondaryBackground: theme.raised,
      closeButton: theme["content-secondary"],
      closeButtonBackground: theme.hover,
      profileForeground: theme.raised,
    });
  }
  const [reconnectOnMount] = useState(() => !isPartnerApprovalPending() && shouldReconnectWallet());
  useEffect(() => {
    if (!isPartnerApprovalPending() && consumeWalletResetNotice()) {
      toast.info(t("Wallet connection reset. Select your account in your wallet, then connect again."));
    }
  }, [t]);
  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={reconnectOnMount}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={walletTheme}
        >
          <AppShell>
            <BrowserRouter>
              <QueryParamProvider adapter={ReactRouterQueryParamAdapter}>
                <AppChainQueryParamNormalizer />
                <RuntimeSelectionCacheReset />
                {!isPartnerApprovalPending() && <>
                  <WalletConnectionRecovery />
                  <TermsAcceptanceModal />
                  <AuthGuard />
                </>}
                <Listeners />
                <AppHeaderShell>
                  <Header />
                </AppHeaderShell>
                <ServerUnavailableBanner />
                <RouteErrorBoundary>
                  <Suspense
                    fallback={
                      <div className="flex h-[50vh] items-center justify-center">
                        <Loader2
                          aria-label="Loading"
                          className="h-8 w-8 animate-spin text-spinner"
                        />
                      </div>
                    }
                  >
                    <Routes>
                      <Route
                        path={ROUTE_PATHS.explorer}
                        element={<RollupExplorerPage />}
                      />
                      <Route
                        path={ROUTE_PATHS.explorerRollup}
                        element={<RollupDetailPage />}
                      />
                      <Route
                        path={ROUTE_PATHS.portfolio}
                        element={<PortfolioPage />}
                      />
                      <Route path={ROUTE_PATHS.rewards} element={<RewardsPage />} />
                      <Route path={ROUTE_PATHS.points} element={<PointsPage />} />
                      <Route
                        path={ROUTE_PATHS.home}
                        element={<RedirectToDefaultTrade />}
                      />
                      <Route
                        path={ROUTE_PATHS.trade}
                        element={<RedirectToDefaultTrade />}
                      />
                      <Route
                        path={ROUTE_PATHS.tradeSymbol}
                        element={<TradingPage />}
                      />
                      <Route
                        path={ROUTE_PATHS.catchAll}
                        element={<RedirectToDefaultTrade />}
                      />
                    </Routes>
                  </Suspense>
                </RouteErrorBoundary>
              </QueryParamProvider>
            </BrowserRouter>
            <Footer />
          </AppShell>
          <ToastContainer />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
