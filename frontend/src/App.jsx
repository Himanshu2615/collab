import { Navigate, Route, Routes } from "react-router";
import { useQuery } from "@tanstack/react-query";

import HomePage from "./pages/HomePage.jsx";
import SignUpPage from "./pages/SignUpPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import CallPage from "./pages/CallPage.jsx";
import FullScreenChatPage from "./pages/FullScreenChatPage.jsx";
import OnboardingPage from "./pages/OnboardingPage.jsx";
import OrganizationSetupPage from "./pages/OrganizationSetupPage.jsx";
import FriendsPage from "./pages/FriendsPage.jsx";
import SearchPage from "./pages/SearchPage.jsx";
import FilesPage from "./pages/FilesPage.jsx";
import SchedulePage from "./pages/SchedulePage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";

import { Toaster } from "react-hot-toast";
import PageLoader from "./components/PageLoader.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import PublicRoute from "./components/PublicRoute.jsx";
import useAuthUser from "./hooks/useAuthUser.js";
import { useThemeStore } from "./store/useThemeStore.js";
import { getMyOrganization } from "./lib/api.js";
import { StreamProvider } from "./context/StreamContext.jsx";

const App = () => {
  const { isLoading, authUser } = useAuthUser();
  const { theme } = useThemeStore();

  const isAuthenticated = Boolean(authUser);
  const isOnboarded = Boolean(authUser?.isOnboarded);

  // Fetch the user's org only when fully onboarded
  const { data: orgData, isLoading: orgLoading } = useQuery({
    queryKey: ["myOrganization"],
    queryFn: getMyOrganization,
    enabled: isAuthenticated && isOnboarded,
    staleTime: 5 * 60 * 1000,
  });

  const hasOrg = Boolean(orgData?.organization);

  if (isLoading || (isOnboarded && orgLoading)) return <PageLoader />;

  // Shared props passed to every route guard
  const guardProps = { isAuthenticated, isOnboarded, hasOrg };

  return (
    <div className="h-screen" data-theme={theme}>
      <StreamProvider>
        <Routes>
        {/* ── Public routes (redirect away when already authenticated) ── */}
        <Route
          path="/signup"
          element={<PublicRoute {...guardProps}><SignUpPage /></PublicRoute>}
        />
        <Route
          path="/login"
          element={<PublicRoute {...guardProps}><LoginPage /></PublicRoute>}
        />

        {/* ── Onboarding: auth required, but no org yet ── */}
        <Route
          path="/onboarding"
          element={
            !isAuthenticated ? (
              <Navigate to="/login" replace />
            ) : isOnboarded ? (
              <Navigate to={hasOrg ? "/" : "/setup-org"} replace />
            ) : (
              <OnboardingPage />
            )
          }
        />

        {/* ── Org setup: auth + onboarded required, but no org yet ── */}
        <Route
          path="/setup-org"
          element={
            !isAuthenticated ? (
              <Navigate to="/login" replace />
            ) : !isOnboarded ? (
              <Navigate to="/onboarding" replace />
            ) : hasOrg ? (
              <Navigate to="/" replace />
            ) : (
              <OrganizationSetupPage />
            )
          }
        />

        {/* ── Protected pages ── */}
        <Route path="/"            element={<ProtectedRoute {...guardProps}><HomePage /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute {...guardProps}><NotificationsPage /></ProtectedRoute>} />
        <Route path="/friends"     element={<ProtectedRoute {...guardProps}><FriendsPage /></ProtectedRoute>} />
        <Route path="/search"      element={<ProtectedRoute {...guardProps}><SearchPage /></ProtectedRoute>} />
        <Route path="/files"       element={<ProtectedRoute {...guardProps}><FilesPage /></ProtectedRoute>} />
        <Route path="/schedule"    element={<ProtectedRoute {...guardProps}><SchedulePage /></ProtectedRoute>} />
        <Route path="/admin"       element={<ProtectedRoute {...guardProps}><AdminPage /></ProtectedRoute>} />
        <Route path="/profile"     element={<ProtectedRoute {...guardProps}><ProfilePage /></ProtectedRoute>} />
        <Route path="/chat/:id"    element={<ProtectedRoute {...guardProps}><FullScreenChatPage /></ProtectedRoute>} />
        <Route path="/call/:id"    element={<ProtectedRoute {...guardProps} withSidebar={false}><CallPage /></ProtectedRoute>} />
        </Routes>
      </StreamProvider>

      <Toaster />
    </div>
  );
};
export default App;

