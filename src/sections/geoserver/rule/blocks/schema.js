import * as Yup from "yup";

const LINECAPS = ["butt", "round", "square"];
const LINEJOINS = ["miter", "round", "bevel"];
const BLENDMODES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
];
const SYMBOLIZERS = ["point", "line", "polygon", "raster", "text"];
const RENDER_MODES = ["text", "symbol", "both"];

// Operator-уудыг жижигрүүлж normalize хийе
const OP_ALLOWED = [
  "eq",
  "neq",
  "lt",
  "lte",
  "gt",
  "gte",
  "contains",
  "startswith",
  "endswith",
  "between",
  "in",
  "isnull",
  "isnotnull",
];

const normalizeOp = (v) => {
  if (!v) return v;
  const s = String(v).trim().toLowerCase();
  // startsWith/endsWith-ийг lowercase болгосон хувилбартай тааруулна
  if (s === "startswith" || s === "startswith") return "startswith";
  if (s === "endswith" || s === "endswith") return "endswith";
  return s;
};

export default function buildSchema() {
  return Yup.object().shape({
    render_mode: Yup.mixed().oneOf(RENDER_MODES).required(),

    cql_filter: Yup.string().nullable(),

    filters: Yup.array().of(
      Yup.object().shape({
        field: Yup.string().required("Талбар сонгоно уу"),
        operator: Yup.string()
          .transform((v) => normalizeOp(v))
          .required("Нөхцөл сонгоно уу")
          .oneOf(OP_ALLOWED, "Буруу нөхцөл"),
        value: Yup.string()
          // NULL шалгалтуудад value шаардлагагүй
          .when("operator", {
            is: (op) => !["isnull", "isnotnull"].includes(normalizeOp(op)),
            then: (schema) => schema.required("Утга шаардлагатай"),
            otherwise: (schema) => schema.notRequired(),
          })
          // between => "a..b" хэлбэр
          .when("operator", {
            is: (op) => normalizeOp(op) === "between",
            then: (schema) =>
              schema.test(
                "between-format",
                "Хооронд нөхцөлд 'a..b' хэлбэрээр оруулна уу",
                (value) => !!value && /.+\.\..+/.test(value)
              ),
          })
          // in => "a,b,c" хэлбэр
          .when("operator", {
            is: (op) => normalizeOp(op) === "in",
            then: (schema) =>
              schema.test(
                "in-format",
                "Жагсаалтын нөхцөлд 'A,B,C' хэлбэрээр оруулна уу",
                (value) =>
                  !!value &&
                  value.includes(",") &&
                  value.split(",").every((v) => String(v).trim().length > 0)
              ),
          }),
      })
    ),

    // Scale
    min_scale_denom: Yup.number()
      .typeError("Тоон утга")
      .nullable(true)
      .min(0, "0-с их/тэнцүү"),
    max_scale_denom: Yup.number()
      .typeError("Тоон утга")
      .nullable(true)
      .min(0, "0-с их/тэнцүү")
      .test(
        "gte-min",
        "MaxScale нь MinScale-ээс багагүй байх ёстой",
        function (value) {
          const minv = this.parent.min_scale_denom;
          if (value != null && minv != null)
            return Number(value) >= Number(minv);
          return true;
        }
      ),

    is_visible: Yup.boolean(),
    opacity: Yup.number().nullable(true).min(0, "0..1").max(1, "0..1"),
    z_index: Yup.number().nullable(true),
    order: Yup.number().nullable(true),
    blend_mode: Yup.mixed().oneOf(BLENDMODES),

    // Геометрийн төрөл (render_mode !== "text" үед ашиглагдана)
    symbolizer: Yup.mixed()
      .oneOf(SYMBOLIZERS)
      .when("render_mode", {
        is: "text",
        then: (s) => s.notRequired(), // text үед symbolizer-ийг албаар шаардахгүй
        otherwise: (s) => s.required("Symbolizer шаардлагатай"),
      }),

    // --- LINE шаардлагууд (зөвхөн render_mode ∈ {symbol,both} && symbolizer==="line") ---
    stroke_color: Yup.string()
      .nullable()
      .when(["render_mode", "symbolizer"], {
        is: (mode, sym) => mode !== "text" && sym === "line",
        then: (s) => s.required("stroke_color оруулна уу."),
      }),
    stroke_width: Yup.number()
      .nullable(true)
      .when(["render_mode", "symbolizer"], {
        is: (mode, sym) => mode !== "text" && sym === "line",
        then: (s) =>
          s.typeError("Тоон утга").required("stroke_width оруулна уу."),
      }),
    stroke_opacity: Yup.number().nullable(true).min(0, "0..1").max(1, "0..1"),
    stroke_dasharray: Yup.string().nullable(),
    stroke_linecap: Yup.mixed()
      .transform((val, orig) => (orig === "" ? null : val))
      .nullable(true)
      .oneOf([...LINECAPS, null])
      .when(["render_mode", "symbolizer"], {
        is: (mode, sym) => mode !== "text" && sym === "line",
        then: (s) => s.required("stroke_linecap сонгоно уу."),
      }),
    stroke_linejoin: Yup.mixed()
      .transform((val, orig) => (orig === "" ? null : val))
      .nullable(true)
      .oneOf([...LINEJOINS, null])
      .when(["render_mode", "symbolizer"], {
        is: (mode, sym) => mode !== "text" && sym === "line",
        then: (s) => s.required("stroke_linejoin сонгоно уу."),
      }),

    // --- POLYGON (шаардлага тавихгүй, зөвхөн зөвшөөрнө) ---
    fill_color: Yup.string().nullable(),
    fill_opacity: Yup.number().nullable(true).min(0, "0..1").max(1, "0..1"),

    // --- POINT (зөвхөн render_mode ∈ {symbol,both} && symbolizer==="point") ---
    size: Yup.number()
      .nullable(true)
      .when(["render_mode", "symbolizer"], {
        is: (mode, sym) => mode !== "text" && sym === "point",
        then: (s) => s.typeError("Тоон утга").required("size оруулна уу."),
      }),
    icon_url: Yup.string().url("Зөв URL оруул").nullable(true),
    rotation: Yup.number().nullable(true),

    // --- TEXT (render_mode==="text" үед заавал, "both" үед бас заавал) ---
    text_field: Yup.string()
      .nullable()
      .when("render_mode", {
        is: (mode) => mode === "text" || mode === "both",
        then: (s) => s.required("Text дүрэмд text_field заавал хэрэгтэй."),
      }),
    text_size: Yup.number().nullable(true),
    text_color: Yup.string().nullable(),
    text_font_family: Yup.string().nullable(),
    text_font_style: Yup.string().nullable(),
    text_font_weight: Yup.string().nullable(),
    text_halo_color: Yup.string().nullable(),
    text_halo_radius: Yup.number().nullable(true),
    text_halo_opacity: Yup.number()
      .nullable(true)
      .min(0, "0..1")
      .max(1, "0..1"),
    text_anchor: Yup.string().nullable(),
    text_displacement_x: Yup.number().nullable(true),
    text_displacement_y: Yup.number().nullable(true),

    // UI-д ашиглагддаг, backend-д boolean хэлбэрээр очиж болно
    is_with_text: Yup.boolean(),

    // JSON (string) шалгалт
    vendor_options: Yup.string()
      .nullable()
      .test("json", "JSON биш байна", (v) => {
        if (!v || !v.trim()) return true;
        try {
          JSON.parse(v);
          return true;
        } catch {
          return false;
        }
      }),
  });
}
