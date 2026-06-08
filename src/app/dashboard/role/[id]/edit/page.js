import PropTypes from 'prop-types';

import { RoleEditView } from 'src/sections/role/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Дашбоард: Эрх засах',
};

export default function RoleEditPage({ params }) {
  const { id } = params;

  return <RoleEditView id={id} />;
}

RoleEditPage.propTypes = {
  params: PropTypes.shape({
    id: PropTypes.string,
  }),
};
