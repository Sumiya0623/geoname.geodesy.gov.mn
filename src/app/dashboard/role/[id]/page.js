import PropTypes from 'prop-types';

import { RoleDetailsView } from 'src/sections/role/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Дашбоард: Эрхийн дэлгэрэнгүй',
};

export default function RoleDetailsPage({ params }) {
  const { id } = params;

  return <RoleDetailsView id={id} />;
}

RoleDetailsPage.propTypes = {
  params: PropTypes.shape({
    id: PropTypes.string,
  }),
};
