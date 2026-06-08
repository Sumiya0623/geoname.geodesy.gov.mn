export default function buildDefaults(currentRule, layer) {
  return {
    name: currentRule?.name || "",
    min_scale_denom: currentRule?.min_scale_denom ?? null,
    max_scale_denom: currentRule?.max_scale_denom ?? null,
    is_visible:
      typeof currentRule?.is_visible === "boolean"
        ? currentRule.is_visible
        : true,
    opacity: currentRule?.opacity ?? 1,
    z_index: currentRule?.z_index ?? 0,
    order: currentRule?.order ?? 0,
    blend_mode: currentRule?.blend_mode || "normal",
    symbolizer: currentRule?.symbolizer || layer?.table?.code || "point",
    stroke_color: currentRule?.stroke_color || "",
    stroke_width: currentRule?.stroke_width ?? null,
    stroke_opacity: currentRule?.stroke_opacity ?? null,
    stroke_dasharray: currentRule?.stroke_dasharray || "",
    stroke_linecap: currentRule?.stroke_linecap || "",
    stroke_linejoin: currentRule?.stroke_linejoin || "",
    fill_color: currentRule?.fill_color || "",
    fill_opacity: currentRule?.fill_opacity ?? null,
    size: currentRule?.size ?? null,
    icon_url: currentRule?.icon_url || "",
    icon: currentRule?.icon || null,
    rotation: currentRule?.rotation ?? null,
    render_mode: currentRule?.render_mode ?? "symbol",
    text_field: currentRule?.text_field || "",
    text_size: currentRule?.text_size ?? null,
    text_color: currentRule?.text_color || "",
    text_font_family: currentRule?.text_font_family || "",
    text_font_style: currentRule?.text_font_style || "",
    text_font_weight: currentRule?.text_font_weight || "",
    text_halo_color: currentRule?.text_halo_color || "",
    text_halo_radius: currentRule?.text_halo_radius ?? 0,
    text_halo_opacity: currentRule?.text_halo_opacity ?? 1,
    text_anchor: currentRule?.text_anchor || "",
    text_displacement_x: currentRule?.text_displacement_x ?? 0,
    text_displacement_y: currentRule?.text_displacement_y ?? 0,
    vendor_options: currentRule?.vendor_options
      ? JSON.stringify(currentRule.vendor_options, null, 2)
      : "",
    filters: currentRule?.filters || [{}],
    filtersLogic: "AND",
  };
}
