import PropTypes from "prop-types";
import { useState } from "react";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import TablePagination from "@mui/material/TablePagination";

import Iconify from "src/components/iconify";

// ----------------------------------------------------------------------

function TablePaginationActions({ count, page, rowsPerPage, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(count / rowsPerPage));
  const [pageInput, setPageInput] = useState("");

  const handleGoToPage = (e) => {
    e.preventDefault();
    const target = parseInt(pageInput, 10);
    if (target >= 1 && target <= totalPages) {
      onPageChange(null, target - 1);
      setPageInput("");
    }
  };

  return (
    <Stack direction="row" alignItems="center" spacing={0.25} sx={{ ml: 1 }}>
      <Box
        component="form"
        onSubmit={handleGoToPage}
        sx={{ display: "flex", alignItems: "center", mr: 0.5 }}
      >
        <TextField
          size="small"
          placeholder={`${page + 1}/${totalPages}`}
          value={pageInput}
          onChange={(e) => setPageInput(e.target.value)}
          inputProps={{
            style: { textAlign: "center", width: 60, padding: "4px 8px" },
          }}
        />
      </Box>

      <IconButton
        size="small"
        disabled={page === 0}
        onClick={(e) => onPageChange(e, 0)}
      >
        <Iconify icon="mdi:chevron-double-left" width={20} />
      </IconButton>

      <IconButton
        size="small"
        disabled={page === 0}
        onClick={(e) => onPageChange(e, page - 1)}
      >
        <Iconify icon="mdi:chevron-left" width={20} />
      </IconButton>

      <IconButton
        size="small"
        disabled={page >= totalPages - 1}
        onClick={(e) => onPageChange(e, page + 1)}
      >
        <Iconify icon="mdi:chevron-right" width={20} />
      </IconButton>

      <IconButton
        size="small"
        disabled={page >= totalPages - 1}
        onClick={(e) => onPageChange(e, totalPages - 1)}
      >
        <Iconify icon="mdi:chevron-double-right" width={20} />
      </IconButton>
    </Stack>
  );
}

TablePaginationActions.propTypes = {
  count: PropTypes.number.isRequired,
  page: PropTypes.number.isRequired,
  rowsPerPage: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
};

// ----------------------------------------------------------------------

export default function TablePaginationCustom({
  dense,
  onChangeDense,
  rowsPerPageOptions = [5, 10, 25],
  count = 0,
  page = 0,
  rowsPerPage = 10,
  onPageChange,
  sx,
  ...other
}) {
  return (
    <Box sx={{ position: "relative", ...sx }}>
      <TablePagination
        rowsPerPageOptions={rowsPerPageOptions}
        component="div"
        labelRowsPerPage="Хуудаслалт:"
        count={count}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={onPageChange}
        {...other}
        ActionsComponent={TablePaginationActions}
        sx={{
          borderTopColor: "transparent",
        }}
      />
    </Box>
  );
}

TablePaginationCustom.propTypes = {
  count: PropTypes.number,
  dense: PropTypes.bool,
  onChangeDense: PropTypes.func,
  onPageChange: PropTypes.func,
  page: PropTypes.number,
  rowsPerPage: PropTypes.number,
  rowsPerPageOptions: PropTypes.arrayOf(PropTypes.number),
  sx: PropTypes.object,
};
