import PropTypes from "prop-types";
import { useRef, useMemo, useState, useEffect } from "react";
import { useFormContext } from "react-hook-form";

import {
  Box,
  Stack,
  Button,
  MenuItem,
  TextField,
  IconButton,
  Typography,
} from "@mui/material";
import { Icon } from "@iconify/react";

import { useGetLegalOrders } from "src/api/legal";
import { useGetConstantsFordropdown } from "src/api/constant";

// ----------------------------------------------------------------------
// Эрх зүйн баримт бичиг — мөр бүр гурван шатлалт dependent dropdown:
//   1) Дээд тогтоол    — LEGAL_LEVELS (LegalOrder.govlevel)
//   2) Баримтын төрөл  — ORDER_TYPES (LegalOrder.type), тухайн түвшингээр
//                        бүртгэгдсэн баримтуудаас илэрсэн төрлүүдээр л дүүргэнэ
//   3) Баримт бичиг    — дээрх хоёр шүүлтээр шүүгдсэн баримтууд
// "Нэмэх" товчоор мөр нэмж олон баримт холбоно. form.orders‑д хадгална.
// ----------------------------------------------------------------------

function OrderRow({ row, onChange, onRemove }) {
  const { constants: legalLevels } = useGetConstantsFordropdown("LEGAL_LEVELS");

  // Сонгосон түвшин (govlevel)‑ээр баримтуудыг татна — эндээс ORDER_TYPES болон
  // баримтын жагсаалт хоёуланг гаргана (нэг л fetch).
  const { legalOrders } = useGetLegalOrders(
    row.legalTypeId ? { govlevel: row.legalTypeId, page_size: 100 } : null
  );

  // Тухайн түвшинд бүртгэгдсэн баримтуудаас илэрсэн ORDER_TYPES (давхцалгүй)
  const orderTypes = useMemo(() => {
    const map = new Map();
    legalOrders.forEach((o) => {
      if (o.type?.id) map.set(o.type.id, o.type);
    });
    return [...map.values()];
  }, [legalOrders]);

  // Баримтын төрөл сонгосон бол түүгээр нэмж шүүнэ, эс бөгөөс бүгд
  const docs = useMemo(
    () =>
      row.orderTypeId
        ? legalOrders.filter((o) => o.type?.id === row.orderTypeId)
        : legalOrders,
    [legalOrders, row.orderTypeId]
  );

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 1 }}>
      {/* 1. Дээд тогтоол (LEGAL_LEVELS) */}
      <TextField
        select
        label="Дээд тогтоол"
        value={row.legalTypeId ? String(row.legalTypeId) : ""}
        onChange={(e) =>
          onChange({
            legalTypeId: e.target.value ? Number(e.target.value) : "",
            orderTypeId: "",
            order: null,
          })
        }
        sx={{ minWidth: 200 }}
      >
        <MenuItem value="">— Сонгох —</MenuItem>
        {legalLevels.map((t) => (
          <MenuItem key={t.id} value={String(t.id)}>
            {t.name}
          </MenuItem>
        ))}
      </TextField>

      {/* 2. Баримтын төрөл (ORDER_TYPES) — түвшингээр шүүгдсэн */}
      <TextField
        select
        label="Баримтын төрөл"
        value={row.orderTypeId ? String(row.orderTypeId) : ""}
        disabled={!row.legalTypeId}
        onChange={(e) =>
          onChange({
            orderTypeId: e.target.value ? Number(e.target.value) : "",
            order: null,
          })
        }
        sx={{ minWidth: 200 }}
      >
        <MenuItem value="">— Сонгох —</MenuItem>
        {orderTypes.map((t) => (
          <MenuItem key={t.id} value={String(t.id)}>
            {t.name}
          </MenuItem>
        ))}
      </TextField>

      {/* 3. Баримт бичиг — дээрх 2 шүүлтээр */}
      <TextField
        select
        label="Баримт бичиг"
        value={row.order?.id ? String(row.order.id) : ""}
        disabled={!row.legalTypeId}
        onChange={(e) => {
          const o = docs.find((x) => String(x.id) === e.target.value);
          onChange({
            order: o
              ? { id: o.id, name: o.name, order_number: o.order_number }
              : null,
          });
        }}
        sx={{ minWidth: 280, flexGrow: 1 }}
      >
        <MenuItem value="">— Сонгох —</MenuItem>
        {docs.map((o) => (
          <MenuItem key={o.id} value={String(o.id)}>
            {o.name || "-"}
            {o.order_number ? ` · №${o.order_number}` : ""}
          </MenuItem>
        ))}
      </TextField>

      <IconButton color="error" onClick={onRemove} sx={{ alignSelf: "center" }}>
        <Icon icon="mdi:close" />
      </IconButton>
    </Stack>
  );
}

OrderRow.propTypes = {
  row: PropTypes.object,
  onChange: PropTypes.func,
  onRemove: PropTypes.func,
};

export default function GeonameOrders({ initialOrders = [], currentId = null }) {
  const { setValue } = useFormContext();
  const uid = useRef(1);

  // Засах үед: o.govlevel (LEGAL_LEVELS) / o.type (ORDER_TYPES) id‑аар dropdown сэргээнэ
  const build = (orders) =>
    orders?.length
      ? orders.map((o) => ({
          uid: uid.current++,
          legalTypeId: o.govlevel || "",
          orderTypeId: o.type || "",
          order: { id: o.id, name: o.name, order_number: o.order_number },
        }))
      : [{ uid: uid.current++, legalTypeId: "", orderTypeId: "", order: null }];

  const [rows, setRows] = useState(() => build(initialOrders));

  // Бичлэг солигдоход (засах) rows‑ийг дахин init хийнэ
  useEffect(() => {
    setRows(build(initialOrders));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  // Зөвхөн хэрэглэгчийн үйлдэлд form.orders‑ийг шинэчилнэ (init дарж бичихгүй)
  const syncForm = (next) =>
    setValue("orders", next.map((r) => r.order).filter(Boolean), {
      shouldDirty: true,
    });

  const updateRow = (i, value) =>
    setRows((prev) => {
      const next = prev.map((r, idx) => (idx === i ? { ...r, ...value } : r));
      syncForm(next);
      return next;
    });
  const removeRow = (i) =>
    setRows((prev) => {
      const next = prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev;
      syncForm(next);
      return next;
    });
  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { uid: uid.current++, legalTypeId: "", orderTypeId: "", order: null },
    ]);

  return (
    <Box sx={{ gridColumn: "1 / -1" }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Шийдвэрүүд (тусгагдсан)
      </Typography>

      {rows.map((r, i) => (
        <OrderRow
          key={r.uid}
          row={r}
          onChange={(value) => updateRow(i, value)}
          onRemove={() => removeRow(i)}
        />
      ))}

      <Button color="primary" variant="outlined" onClick={addRow}>
        нэмэх
      </Button>
    </Box>
  );
}

GeonameOrders.propTypes = {
  initialOrders: PropTypes.array,
  currentId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};
