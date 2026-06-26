'use client';

import PropTypes from 'prop-types';
import { usePathname } from 'next/navigation';

import { AuthGuard } from 'src/auth/guard';
import DashboardLayout from 'src/layouts/dashboard';
import FilteredNextStep from 'src/components/tour/FilteredNextStep';

// ----------------------------------------------------------------------

export default function Layout({ children }) {
  const pathname = usePathname();
  // Газрын зураг — dashboard chrome‑гүй бүтэн дэлгэцийн geoportal layout
  // (/dashboard/map ба төслийн /dashboard/champaign/<id>/map хоёулаа)
  const isFullScreenMap =
    pathname?.startsWith('/dashboard/map') ||
    /^\/dashboard\/champaign\/[^/]+\/map(\/|$)/.test(pathname || '');

  if (isFullScreenMap) {
    return <AuthGuard>{children}</AuthGuard>;
  }

  return (
    <AuthGuard>
      <FilteredNextStep scrollToTop={false}>
        <DashboardLayout>{children}</DashboardLayout>
      </FilteredNextStep>
    </AuthGuard>
  );
}

Layout.propTypes = {
  children: PropTypes.node,
};
