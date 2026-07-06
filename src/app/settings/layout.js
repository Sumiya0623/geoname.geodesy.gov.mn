'use client';

import PropTypes from 'prop-types';

import { AuthGuard } from 'src/auth/guard';
import DashboardLayout from 'src/layouts/dashboard';
import FilteredNextStep from 'src/components/tour/FilteredNextStep';

// ----------------------------------------------------------------------
// Тохиргооны хэсэг нь /settings төвшинд боловч dashboard-ийн адил
// нэвтрэлтийн хамгаалалт (AuthGuard) болон цэс/header (DashboardLayout)-ийг
// дахин ашиглана.

export default function SettingsLayout({ children }) {
  return (
    <AuthGuard>
      <FilteredNextStep scrollToTop={false}>
        <DashboardLayout>{children}</DashboardLayout>
      </FilteredNextStep>
    </AuthGuard>
  );
}

SettingsLayout.propTypes = {
  children: PropTypes.node,
};
