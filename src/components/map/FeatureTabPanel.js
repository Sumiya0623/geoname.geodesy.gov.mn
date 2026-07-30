import PropTypes from "prop-types";
import { useMemo } from "react";

import { useState } from "react";
import {
  Box,
  Menu,
  Table,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  TableRow,
  Checkbox,
  TableBody,
  TableCell,
  TableHead,
  Typography,
  IconButton,
  TablePagination,
  TableSortLabel,
  CircularProgress,
} from "@mui/material";
import {
  Edit as EditIcon,
  MoreVert as MoreVertIcon,
  MyLocation as ZoomToIcon,
  SwapHoriz as ReverseIcon,
  DeleteOutline as DeleteIcon,
} from "@mui/icons-material";

import FeatureTableToolbar from "./FeatureTableToolbar";

// ----------------------------------------------------------------------
// Доод attribute хүснэгтийн НЭГ ТАБ — тоолбар + хүснэгт + хуудаслалт.
// Бүх төлөв (хайлт, нуусан багана, сонголт, хуудас) эцэг дэх tab объектод
// хадгалагдаж, onPatch‑аар шинэчлэгдэнэ.
// ----------------------------------------------------------------------

export default function FeatureTabPanel({
  tab,
  onPatch,
  onClose,
  onZoomTo,
  // Мөрийн 3 цэгийн цэс: (row, action) — "edit" | "reverse" | "delete"
  onRowAction,
  onFieldCalc,
  onAddName,
  onLinkName,
}) {
  const [rowMenu, setRowMenu] = useState(null);
  const cols = useMemo(() => tab.cols || [], [tab.cols]);
  const visibleCols = useMemo(
    () => cols.filter((c) => !tab.hiddenCols?.has(c)),
    [cols, tab.hiddenCols],
  );

  // Хайлт + "зөвхөн сонгосон" шүүлт
  const rows = useMemo(() => {
    let out = tab.rows || [];
    const q = (tab.searchText || "").trim().toLowerCase();
    if (q) {
      out = out.filter((r) => {
        const targets = tab.searchCol
          ? [r.props?.[tab.searchCol]]
          : Object.values(r.props || {});
        return targets.some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(q),
        );
      });
    }
    if (tab.filteringSelected && tab.selected?.size) {
      out = out.filter((r) => tab.selected.has(r.id));
    }
    // Багана дээр дарж ЭРЭМБЭЛЭХ — тоо бол тоогоор, эс бол цагаан толгойгоор
    if (tab.orderBy) {
      const dir = tab.order === "desc" ? -1 : 1;
      out = [...out].sort((a, b) => {
        const va = a.props?.[tab.orderBy];
        const vb = b.props?.[tab.orderBy];
        const ea = va === null || va === undefined || va === "";
        const eb = vb === null || vb === undefined || vb === "";
        if (ea && eb) return 0;
        if (ea) return 1; // хоосныг үргэлж доор нь
        if (eb) return -1;
        const na = Number(va);
        const nb = Number(vb);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return (na - nb) * dir;
        return String(va).localeCompare(String(vb), "mn") * dir;
      });
    }
    return out;
  }, [
    tab.rows,
    tab.searchText,
    tab.searchCol,
    tab.filteringSelected,
    tab.selected,
    tab.orderBy,
    tab.order,
  ]);

  const page = Math.min(tab.page || 0, Math.max(0, Math.ceil(rows.length / tab.pageSize) - 1));
  const pageRows = rows.slice(page * tab.pageSize, page * tab.pageSize + tab.pageSize);
  const selCount = tab.selected?.size || 0;
  const canReset =
    !!(tab.searchText || tab.searchCol || tab.orderBy) ||
    tab.filteringSelected ||
    (tab.hiddenCols?.size || 0) > 0;

  const toggleRow = (id) =>
    onPatch((t) => {
      const next = new Set(t.selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selected: next };
    });

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {!tab.loading && !tab.error && (
        <FeatureTableToolbar
          onAddName={onAddName}
          onLinkName={onLinkName}
          cols={cols}
          searchCols={visibleCols}
          searchCol={tab.searchCol}
          onSearchCol={(v) => onPatch({ searchCol: v, page: 0 })}
          searchText={tab.searchText}
          onSearchText={(v) => onPatch({ searchText: v, page: 0 })}
          hiddenCols={tab.hiddenCols}
          onToggleCol={(c) =>
            onPatch((t) => {
              const next = new Set(t.hiddenCols);
              if (next.has(c)) next.delete(c);
              else next.add(c);
              return { hiddenCols: next };
            })
          }
          selectedCount={selCount}
          filteringSelected={tab.filteringSelected}
          onSelectAll={() =>
            onPatch({ selected: new Set(rows.map((r) => r.id)) })
          }
          onInvertSelection={() =>
            onPatch((t) => {
              const next = new Set();
              (t.rows || []).forEach((r) => {
                if (!t.selected.has(r.id)) next.add(r.id);
              });
              return { selected: next };
            })
          }
          onDeselectAll={() =>
            onPatch({ selected: new Set(), filteringSelected: false })
          }
          onFilterSelected={() =>
            onPatch((t) => ({ filteringSelected: !t.filteringSelected, page: 0 }))
          }
          canReset={canReset}
          onReset={() =>
            onPatch({
              searchText: "",
              searchCol: "",
              hiddenCols: new Set(),
              filteringSelected: false,
              orderBy: "",
              order: "asc",
              page: 0,
            })
          }
          onClose={onClose}
          onFieldCalc={onFieldCalc}
        />
      )}

      <Box sx={{ flex: 1, overflow: "auto", pl: 2 }}>
        {tab.loading && (
          <Box sx={{ p: 2, display: "flex", gap: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2">Уншиж байна...</Typography>
          </Box>
        )}
        {tab.error && (
          <Typography variant="body2" sx={{ p: 2 }} color="text.secondary">
            {tab.error}
          </Typography>
        )}
        {!tab.loading && !tab.error && (
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    indeterminate={selCount > 0 && selCount < rows.length}
                    checked={rows.length > 0 && selCount === rows.length}
                    onChange={(e) =>
                      onPatch({
                        selected: e.target.checked
                          ? new Set(rows.map((r) => r.id))
                          : new Set(),
                      })
                    }
                  />
                </TableCell>
                {visibleCols.map((c) => (
                  <TableCell
                    key={c}
                    sortDirection={tab.orderBy === c ? tab.order : false}
                  >
                    <TableSortLabel
                      active={tab.orderBy === c}
                      direction={tab.orderBy === c ? tab.order : "asc"}
                      onClick={() =>
                        onPatch((t) => ({
                          orderBy: c,
                          order:
                            t.orderBy === c && t.order === "asc"
                              ? "desc"
                              : "asc",
                          page: 0,
                        }))
                      }
                    >
                      {c}
                    </TableSortLabel>
                  </TableCell>
                ))}
                <TableCell sx={{ width: 80 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.map((r, i) => (
                <TableRow
                  key={r.id || i}
                  hover
                  selected={tab.selected?.has(r.id)}
                  onClick={() => toggleRow(r.id)}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={!!tab.selected?.has(r.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleRow(r.id)}
                    />
                  </TableCell>
                  {visibleCols.map((c) => (
                    <TableCell key={c}>
                      {r.props[c] == null ? "" : String(r.props[c])}
                    </TableCell>
                  ))}
                  <TableCell padding="none" sx={{ whiteSpace: "nowrap" }}>
                    {r.geometry && (
                      <Tooltip title="Байршил руу очих">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            onZoomTo?.(r.geometry);
                          }}
                        >
                          <ZoomToIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {onRowAction && (
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRowMenu({ anchor: e.currentTarget, row: r });
                        }}
                      >
                        <MoreVertIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={visibleCols.length + 2}>
                    <Typography variant="caption" color="text.secondary">
                      Мөр алга.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Box>

      {/* Мөрийн үйлдлийн цэс */}
      <Menu
        anchorEl={rowMenu?.anchor}
        open={Boolean(rowMenu)}
        onClose={() => setRowMenu(null)}
        slotProps={{ paper: { sx: { minWidth: 200 } } }}
      >
        <MenuItem
          onClick={() => {
            const r = rowMenu?.row;
            setRowMenu(null);
            onRowAction?.(r, "edit");
          }}
        >
          <ListItemIcon>
            <EditIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText>Засах</ListItemText>
        </MenuItem>
        {/* Геометр эргүүлэх зөвхөн LINE объектод утгатай (vertex дараалал урвуулах) */}
        {/line/i.test(
          rowMenu?.row?.geometry?.getType?.() ||
            rowMenu?.row?.geometry?.type ||
            rowMenu?.row?.props?.geom_type ||
            "",
        ) && (
          <MenuItem
            onClick={() => {
              const r = rowMenu?.row;
              setRowMenu(null);
              onRowAction?.(r, "reverse");
            }}
          >
            <ListItemIcon>
              <ReverseIcon sx={{ fontSize: 18 }} />
            </ListItemIcon>
            <ListItemText>Геометр эргүүлэх</ListItemText>
          </MenuItem>
        )}
        <MenuItem
          sx={{ color: "error.main" }}
          onClick={() => {
            const r = rowMenu?.row;
            setRowMenu(null);
            onRowAction?.(r, "delete");
          }}
        >
          <ListItemIcon>
            <DeleteIcon sx={{ fontSize: 18, color: "error.main" }} />
          </ListItemIcon>
          <ListItemText>Устгах</ListItemText>
        </MenuItem>
      </Menu>

      {!tab.loading && !tab.error && (
        <TablePagination
          component="div"
          count={rows.length}
          page={page}
          rowsPerPage={tab.pageSize}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage="Хуудаслалт:"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
          onPageChange={(e, p) => onPatch({ page: p })}
          onRowsPerPageChange={(e) =>
            onPatch({ pageSize: parseInt(e.target.value, 10), page: 0 })
          }
          sx={{
            flexShrink: 0,
            borderTop: "1px solid",
            borderColor: "divider",
            "& .MuiTablePagination-toolbar": { minHeight: 40 },
          }}
        />
      )}
    </Box>
  );
}

FeatureTabPanel.propTypes = {
  onFieldCalc: PropTypes.func,
  onAddName: PropTypes.func,
  onLinkName: PropTypes.func,
  onRowAction: PropTypes.func,
  tab: PropTypes.object,
  onPatch: PropTypes.func,
  onClose: PropTypes.func,
  onZoomTo: PropTypes.func,
};
