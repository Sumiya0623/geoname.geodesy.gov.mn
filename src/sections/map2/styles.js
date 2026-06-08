import { GlobalStyles } from "@mui/material";

// ... component JSX дотор хаа нэгтээ (ихэвчлэн root-д)
<GlobalStyles
  styles={(theme) => ({
    /* LayerSwitcher үндсэн самбар */
    ".ol-control.ol-layerswitcher": {
      width: 360,
      maxHeight: "calc(100vh - 24px)",
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: theme.shadows[6],
      backgroundColor: theme.palette.background.paper,
      border: `1px solid ${theme.palette.divider}`,
    },

    /* Header (манай өөрийн class) */
    ".lsx-header": {
      backgroundColor: "#0B2A52", // зурагт байсан шиг хөх
      color: theme.palette.common.white,
      padding: "12px 14px",
    },
    ".lsx-bar": {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 10,
    },
    ".lsx-title": {
      fontWeight: 700,
      fontSize: 14,
      letterSpacing: ".3px",
      textTransform: "uppercase",
    },
    ".lsx-close": {
      appearance: "none",
      border: 0,
      background: theme.palette.warning.main, // шар
      color: theme.palette.getContrastText(theme.palette.warning.main),
      width: 36,
      height: 36,
      borderRadius: 8,
      fontSize: 18,
      cursor: "pointer",
      lineHeight: 1,
    },

    /* Дээд талын 3 select + ХАРАХ */
    ".lsx-filters": {
      display: "grid",
      gridTemplateColumns: "1fr",
      rowGap: 10,
    },
    ".lsx-select": {
      height: 40,
      padding: "0 12px",
      borderRadius: 8,
      border: `1px solid ${theme.palette.divider}`,
      backgroundColor: theme.palette.background.paper,
      color: theme.palette.text.primary,
      fontSize: 14,
      outline: "none",
    },
    ".lsx-apply": {
      height: 40,
      borderRadius: 8,
      border: 0,
      background: theme.palette.warning.main,
      color: theme.palette.getContrastText(theme.palette.warning.main),
      fontWeight: 700,
      letterSpacing: ".3px",
      cursor: "pointer",
    },

    /* Доорх жагсаалтыг жаахан зайтай, цэвэрхэн болгоё */
    ".ol-control.ol-layerswitcher .panel": {
      padding: 10,
    },
    ".ol-control.ol-layerswitcher .panel ul": {
      margin: 0,
    },
    ".ol-control.ol-layerswitcher .panel li label": {
      fontSize: 14,
    },
  })}
/>;
