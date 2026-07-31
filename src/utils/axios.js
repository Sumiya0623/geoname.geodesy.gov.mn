import axios from "axios";

import { HOST_API, MAIN_API } from "src/config-global";

// ----------------------------------------------------------------------

export const axiosInstance = axios.create({
  baseURL: HOST_API, // ж: "http://point.local.nextgis.mn:8009/api"
  withCredentials: true,
});

// --- 2) ТӨВ системийн instance (refresh энд хийнэ)
export const coreApi = axios.create({
  baseURL: MAIN_API,
  withCredentials: true,
});

// --- 3) 401 -> refresh -> retry (once)
let isRefreshing = false;
let waiters = [];

function notifyWaiters() {
  waiters.forEach((resume) => resume());
  waiters = [];
}

axiosInstance.interceptors.response.use(
  (res) => res,
  async (error) => {
    const cfg = error?.config;

    // 401 биш эсвэл аль хэдийн retry хийсэн бол дамжуул
    if (error?.response?.status !== 401 || cfg?._retry) {
      return Promise.reject(error);
    }

    // refresh хийгдэж байвал дуусахыг хүлээнэ
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        waiters.push(() => {
          cfg._retry = true;
          axiosInstance.request(cfg).then(resolve).catch(reject);
        });
      });
    }

    isRefreshing = true;
    try {
      // !!! Танай төв системийн бодит refresh endpoint-оо энд тавь
      // ж: /api/account/refresh/ эсвэл /api/core/user/refresh/
      await coreApi.post("/core/user/refresh/"); // <-- ШААРДЛАГАТАЙ БОЛ ЗАС

      isRefreshing = false;
      notifyWaiters();

      cfg._retry = true;
      return axiosInstance.request(cfg);
    } catch (e) {
      isRefreshing = false;
      waiters = [];
      return Promise.reject(e);
    }
  },
);
export default axiosInstance;

export const fetcher = async (args) => {
  const [url, customAxios = axiosInstance, method = "get", body, config] =
    Array.isArray(args) ? args : [args];

  if (method.toLowerCase() === "get") {
    const res = await customAxios.get(url, { ...(config || {}) });
    return res?.data;
  }
  const res = await customAxios[method](url, body, { ...(config || {}) });
  return res?.data;
};
// ----------------------------------------------------------------------

export const endpoints = {
  auth: {
    logout: "/api/account/logout/",
    refresh: `/api/account/refresh/`,
  },
  menu: {
    list: (request_body) => `/api/core/constant/menus/?${request_body}`,
    edit: (id) => `/api/core/constant/${id}/`,
    create: `/api/core/constant/menus/`,
    delete: (id) => `/api/core/constant/${id}/`,
    details: (id) => `/api/core/constant/${id}/`,
    dropdown: `/api/core/constant/menus/?pagination=false`,
  },
  submenu: {
    list: (request_body) => `/api/core/constant/submenus/?${request_body}`,
    edit: (id) => `/api/core/constant/${id}/`,
    create: `/api/core/constant/`,
    delete: (id) => `/api/core/constant/${id}/`,
    details: (id) => `/api/core/constant/${id}/`,
    dropdown: `/api/core/submenu/?pagination=false`,
  },
  action: {
    list: (request_body) => `/api/core/action/?${request_body}`,
    edit: (id) => `/api/core/action/${id}/`,
    create: `/api/core/action/`,
    delete: (id) => `/api/core/action/${id}/`,
    details: (id) => `/api/core/action/${id}/`,
    dropdown: `/api/core/action/?pagination=false`,
  },
  role: {
    list: (request_body) => `/api/core/role/?${request_body}`,
    edit: (id) => `/api/core/role/${id}/`,
    create: `/api/core/role/`,
    delete: (id) => `/api/core/role/${id}/`,
    details: (id) => `/api/core/role/${id}/`,
    dropdown: `/api/core/role/?pagination=false`,
  },

  constant: {
    list: (request_body) => `/api/core/constant/?${request_body}`,
    edit: (id) => `/api/core/constant/${id}/`,
    create: `/api/core/constant/`,
    delete: (id) => `/api/core/constant/${id}/`,
    details: (id) => `/api/core/constant/${id}/`,
    dropdown: (request_body) =>
      `/api/core/constant/?dropdown=true&pagination=false&${request_body}`,
    menus: (request_body) => `/api/core/constant/menus/?${request_body}`,
    role: (id) => `/api/core/constant/${id}/role/`,
    submenuActions: (id) => `/api/core/constant/${id}/submenu-actions/`,
    addAction: (id) => `/api/core/constant/${id}/add-action/`,
    removeAction: (id) => `/api/core/constant/${id}/remove-action/`,
    systemreg: `/api/core/constant/system-registered/`,
    networkreg: `/api/core/constant/network-registered/`,
    status: (request_body) => `/api/core/status/?${request_body}`,
    geoserverfields: (request_body) =>
      `/api/core/constant/geoserverfields/?pagination=false&${request_body}`,
  },

  nameclass: {
    list: (request_body) => `/api/g/nameclass/tree/?${request_body}`,
    create: `/api/g/nameclass/`,
    edit: (id) => `/api/g/nameclass/${id}/`,
    delete: (id) => `/api/g/nameclass/${id}/`,
    details: (id) => `/api/g/nameclass/${id}/`,
    sld: (id) => `/api/g/nameclass/${id}/sld/`,
    uploadSymbol: (id) => `/api/g/nameclass/${id}/upload-symbol/`,
  },

  request: {
    list: (request_body) => `/api/r/request/?${request_body}`,
    create: `/api/r/request/`,
    edit: (id) => `/api/r/request/${id}/`,
    delete: (id) => `/api/r/request/${id}/`,
    details: (id) => `/api/r/request/${id}/`,
    geonames: (request_body) => `/api/n/geoname/dropdown/?${request_body}`,
    status: (request_body) => `/api/core/status/?${request_body}`,
    upload: (id) => `/api/r/request/${id}/upload/`,
    locate: (request_body) => `/api/r/request/locate/?${request_body}`,
    form: (id) => `/api/r/request/${id}/form/`,
    checkUser: `/api/r/request/check-user/`,
  },

  geoname: {
    list: (request_body) => `/api/n/geoname/?${request_body}`,
    create: `/api/n/geoname/`,
    edit: (id) => `/api/n/geoname/${id}/`,
    delete: (id) => `/api/n/geoname/${id}/`,
    details: (id) => `/api/n/geoname/${id}/`,
    types: `/api/n/geoname/types/`,
    // ЗЗ нэгж(үүд)-д багтах батлагдсан нэрсийн ангиллын задаргаа
    typeSummary: (request_body) =>
      `/api/n/geoname/type-summary/?${request_body}`,
    addPhoto: (id) => `/api/n/geoname/${id}/add-photo/`,
    delPhoto: (id) => `/api/n/geoname/${id}/del-photo/`,
    addAttach: (id) => `/api/n/geoname/${id}/add-attach/`,
    addOrder: (id) => `/api/n/geoname/${id}/add-order/`,
    addRequest: (id) => `/api/n/geoname/${id}/add-request/`,
    inquire: (id) => `/api/n/geoname/${id}/inquire/`,
    inquireVerify: (code) => `/api/n/geoname/inquire-verify/?code=${code}`,
  },

  raster: {
    list: (request_body) => `/api/n/raster/?${request_body}`,
    details: (id) => `/api/n/raster/${id}/`,
    delete: (id) => `/api/n/raster/${id}/`,
    print: `/api/n/raster/print/`,
    adjacent: (request_body) => `/api/n/raster/adjacent/?${request_body}`,
    geometry: (request_body) => `/api/n/raster/geometry/?${request_body}`,
    preview: (request_body) => `/api/n/raster/preview/?${request_body}`,
    // Ажлын зураг (хээрийн судалгаа — төслийн дахин тооллогоор)
    workUnits: (request_body) => `/api/n/raster/work-units/?${request_body}`,
    workPreview: (request_body) =>
      `/api/n/raster/work-preview/?${request_body}`,
    workPrint: `/api/n/raster/work-print/`,
  },

  legal: {
    types: (request_body) => `/api/r/legal-type/?${request_body}`,
    list: (request_body) => `/api/r/legal/?${request_body}`,
    create: `/api/r/legal/`,
    edit: (id) => `/api/r/legal/${id}/`,
    delete: (id) => `/api/r/legal/${id}/`,
    details: (id) => `/api/r/legal/${id}/`,
    attachProject: (id) => `/api/r/legal/${id}/attach-project/`,
    // Төслийн хамрах ЗЗ нэгжид харьяалагдах БҮХ шийдвэрийг нэг дор холбох
    attachByUnits: `/api/r/legal/attach-by-units/`,
    detachProject: (id) => `/api/r/legal/${id}/detach-project/`,
    unitExtent: (id) => `/api/r/legal-unit/${id}/extent/`,
    // Газрын зургийн overlay — ЗЗ нэгжийн тогтоол/шийдвэрийн тоо (GeoJSON)
    mapCounts: (request_body) => `/api/r/legal/map-counts/?${request_body}`,
    // Шийдвэрийн сангийн мод: Нийт / Аймаг → Сум → Төрөл
    unitTree: (request_body) => `/api/r/legal/unit-tree/?${request_body}`,
    units: (request_body) =>
      `/api/r/legal-unit/?pagination=false&${request_body}`,
    unitExtent: (id) => `/api/r/legal-unit/${id}/extent/`,
    unitLocate: (request_body) => `/api/r/legal-unit/locate/?${request_body}`,
  },

  council: {
    list: (request_body) => `/api/r/council/?${request_body}`,
    create: `/api/r/council/`,
    edit: (id) => `/api/r/council/${id}/`,
    delete: (id) => `/api/r/council/${id}/`,
    members: (request_body) => `/api/r/council-member/?${request_body}`,
    memberCreate: `/api/r/council-member/`,
    // Регистрээр системийн хэрэглэгчийг олох/үүсгэх (роль + нэгж онооно)
    ensurePerson: `/api/r/council-member/ensure-person/`,
    memberRelease: (id) => `/api/r/council-member/${id}/release/`,
    memberDelete: (id) => `/api/r/council-member/${id}/`,
  },

  recount: {
    list: (request_body) => `/api/r/recount/?${request_body}`,
    create: `/api/r/recount/`,
    bulk: `/api/r/recount/bulk/`,
    edit: (id) => `/api/r/recount/${id}/`,
    delete: (id) => `/api/r/recount/${id}/`,
    wms: (request_body) => `/api/r/recount/wms/?${request_body}`,
    typeTree: (request_body) => `/api/r/recount/type-tree/?${request_body}`,
    // Ангиллын тоо — жагсаалттай ижил шүүлтээр (хүснэгтийн дээд таб)
    typeSummary: (request_body) =>
      `/api/r/recount/type-summary/?${request_body}`,
    // Тодруулалт үүсгэсэн хэрэглэгчид (шүүлтийн сонголт)
    users: (request_body) => `/api/r/recount/users/?${request_body}`,
    unitTree: (request_body) => `/api/r/recount/unit-tree/?${request_body}`,
    // Хээрийн зураг (Photo — тодруулалт дээр шууд)
    addPhoto: (id) => `/api/r/recount/${id}/add-photo/`,
    delPhoto: (id) => `/api/r/recount/${id}/del-photo/`,
    reverseGeom: (id) => `/api/r/recount/${id}/reverse-geom/`,
    // Төслийн хамрах талбайд (units) багтах бүх батлагдсан нэрийг импортлох
    importByUnits: `/api/r/recount/import-by-units/`,
  },

  workspace: {
    tree: (request_body) => `/api/g/ws/tree/?${request_body}`,
    create: `/api/g/ws/`,
    edit: (id) => `/api/g/ws/${id}/`,
    delete: (id) => `/api/g/ws/${id}/`,
    details: (id) => `/api/g/ws/${id}/`,
    gsStatus: (id) => `/api/g/ws/${id}/gs-status/`,
    gsService: (id) => `/api/g/ws/${id}/gs-service/`,
    gsSync: (id) => `/api/g/ws/${id}/gs-sync/`,
    typeViews: (id) => `/api/g/ws/${id}/type-views/`,
    gsLayerService: (id) => `/api/g/ws/${id}/gs-layer-service/`,
    gsStores: (id) => `/api/g/ws/${id}/gs-stores/`,
    gsCreateStore: (id) => `/api/g/ws/${id}/gs-create-store/`,
    gsDeleteStore: (id) => `/api/g/ws/${id}/gs-delete-store/`,
    gsLayers: (id, q) => `/api/g/ws/${id}/gs-layers/?${q}`,
    gsAllLayers: (id) => `/api/g/ws/${id}/gs-all-layers/`,
    gsLayerSld: (id, layer) =>
      `/api/g/ws/${id}/gs-layer-sld/?layer=${encodeURIComponent(layer)}`,
    gsUploadSymbol: (id) => `/api/g/ws/${id}/gs-upload-symbol/`,
    gsLayerFields: (id, layer) =>
      `/api/g/ws/${id}/gs-layer-fields/?layer=${encodeURIComponent(layer)}`,
    gsCreateGroupedView: (id) => `/api/g/ws/${id}/gs-create-grouped-view/`,
    gsDeleteView: (id) => `/api/g/ws/${id}/gs-delete-view/`,
    gsBoundaryLabel: (id) => `/api/g/ws/${id}/gs-boundary-label/`,
    gsBoundaryLabelState: (id, layer) =>
      `/api/g/ws/${id}/gs-boundary-label/?layer=${encodeURIComponent(layer)}`,
    gsLayergroups: (id) => `/api/g/ws/${id}/gs-layergroups/`,
    gsLayergroup: (id, name) =>
      `/api/g/ws/${id}/gs-layergroup/?name=${encodeURIComponent(name)}`,
    gsSaveLayergroup: (id) => `/api/g/ws/${id}/gs-save-layergroup/`,
    gsDeleteLayergroup: (id) => `/api/g/ws/${id}/gs-delete-layergroup/`,
    gsCreateLayer: (id) => `/api/g/ws/${id}/gs-create-layer/`,
    gsUpdateLayer: (id) => `/api/g/ws/${id}/gs-update-layer/`,
    gsDeleteLayer: (id) => `/api/g/ws/${id}/gs-delete-layer/`,
  },

  // Газрын зургийн суурь/нэмэлт давхаргын удирдлага (/settings/gis?tab=basemap)
  basemap: {
    list: (request_body) => `/api/g/basemap/?${request_body}`,
    create: `/api/g/basemap/`,
    edit: (id) => `/api/g/basemap/${id}/`,
    delete: (id) => `/api/g/basemap/${id}/`,
    details: (id) => `/api/g/basemap/${id}/`,
    available: (request_body) =>
      `/api/g/basemap/available/?${request_body || ""}`,
    forMap: `/api/g/basemap/for-map/`,
    // Давхаргын хил (Zoom to Layer) — ?layer=<ws:name>
    layerExtent: (layer) =>
      `/api/g/basemap/layer-extent/?layer=${encodeURIComponent(layer)}`,
  },

  // Байр зүйн каталог (map_* хүснэгт) — Data tab CRUD (/api/m/)
  mapcat: {
    meta: `/api/m/catalog/`,
    list: (layer, q = "") => `/api/m/catalog/${layer}/?${q}`,
    create: (layer) => `/api/m/catalog/${layer}/`,
    item: (layer, id) => `/api/m/catalog/${layer}/${id}/`,
    bulkDelete: (layer) => `/api/m/catalog/${layer}/bulk-delete/`,
    constant: (q = "") => `/api/m/map-constant/?${q}`,
    constantItem: (id) => `/api/m/map-constant/${id}/`,
    constantCreate: `/api/m/map-constant/`,
    constantKeys: `/api/m/map-constant/keys/`,
  },

  // GeoServer — backend нь /api/g/ дээр (ws/st/fs/rule/group/item).
  // api/map.js болон газрын зургийн давхаргын мод (fs/geoserver) үүнийг ашиглана.
  geoserver: {
    list: (request_body) => `/api/g/geoserver/?${request_body}`,
    edit: (id) => `/api/g/geoserver/${id}/`,
    create: `/api/g/geoserver/`,
    delete: (id) => `/api/g/geoserver/${id}/`,
    details: (id) => `/api/g/geoserver/${id}/`,
    remove: (id) => `/api/g/geoserver/remove/${id}/`,
    dropdown: (request_body) =>
      `/api/g/geoserver/dropdown/?pagination=false&${request_body}`,
    layer: {
      list: (request_body) => `/api/g/fs/?${request_body}`,
      edit: (id) => `/api/g/fs/${id}/`,
      create: `/api/g/fs/`,
      delete: (id) => `/api/g/fs/${id}/`,
      details: (id) => `/api/g/fs/${id}/`,
      remove: (id) => `/api/g/fs/remove/${id}/`,
      geoserver: (request_body) => `/api/g/fs/geoserver/?${request_body}`,
      attributes: (request_body) => `/api/g/fs/attributes/?${request_body}`,
      stylefields: (request_body) =>
        `/api/g/nameclass/style-fields/?${request_body}`,
      baseLayers: `/api/g/fs/baselayers/`,
    },
    style: {
      list: (request_body) => `/api/g/style/?${request_body}`,
      edit: (id) => `/api/g/style/${id}/`,
      create: `/api/g/style/`,
      delete: (id) => `/api/g/style/${id}/`,
      details: (id) => `/api/g/style/${id}/`,
      rule: {
        list: (request_body) => `/api/g/rule/?${request_body}`,
        edit: (id) => `/api/g/rule/${id}/`,
        create: `/api/g/rule/`,
        delete: (id) => `/api/g/rule/${id}/`,
        details: (id) => `/api/g/rule/${id}/`,
        iconPreview: (svg) => `/api/g/rule/icon/${encodeURIComponent(svg)}`,
        importDefault: `/api/g/rule/import-default/`,
      },
    },
    group: {
      list: (request_body) => `/api/g/group/?${request_body}`,
      edit: (id) => `/api/g/group/${id}/`,
      create: `/api/g/group/`,
      delete: (id) => `/api/g/group/${id}/`,
      details: (id) => `/api/g/group/${id}/`,
    },
    geoserver: (request_body) => `/api/g/fs/geoserver/?${request_body}`,
  },

  unit: {
    list: (request_body) => `/api/core/unit/?${request_body}`,
    edit: (id) => `/api/core/unit/${id}/`,
    create: `/api/core/unit/`,
    delete: (id) => `/api/core/unit/${id}/`,
    details: (id) => `/api/core/unit/${id}/`,
    dropdown: (request_body) =>
      `/api/core/unit/dropdown/?pagination=false&${request_body}`,
  },
  nameCategory: {
    list: (request_body) => `/api/m/namecategory/?${request_body}`,
    locate: (request_body) => `/api/m/namecategory/locate/?${request_body}`,
  },

  status: {
    list: (request_body) => `/api/core/status/?${request_body}`,
  },

  user: {
    list: (request_body) => `/api/core/user/?${request_body}`,
    info: `/api/core/user/me/`,
    logout: `/api/core/user/logout/`,
    pluginToken: `/api/core/user/plugin-token/`,
    edit: (id) => `/api/core/user/${id}/`,
    create: `/api/core/user/`,
    delete: (id) => `/api/core/user/${id}/`,
    details: (id) => `/api/core/user/${id}/`,
    dropdown: (params) => `/api/core/user/?pagination=false&${params}`,
    org: (params) =>
      `/api/core/user/?pagination=false&is_citizen=false&${params}`,
    related: (request_body) => `/api/core/user/related/?${request_body}`,
  },

  champaign: {
    list: (request_body) => `/api/n/project/?${request_body}`,
    details: (id) => `/api/n/project/${id}/`,
    sync: (request_body = "") => `/api/n/project/sync/?${request_body}`,
    dropdown: (params) => `/api/n/project/?pagination=false${params}`,
    // Төслийн хамрах ЗЗ нэгж — тусдаа эрхтэй (unit_add / unit_remove)
    unitAdd: (id) => `/api/n/project/${id}/unit-add/`,
    unitRemove: (id) => `/api/n/project/${id}/unit-remove/`,
    // Төслийн ажлын талбай (ProjectArea) — газрын зураг дээр зурсан polygon
    areas: (projectId) =>
      `/api/n/project-area/?pagination=false&project=${projectId}`,
    areaCreate: () => `/api/n/project-area/`,
    areaDetail: (id) => `/api/n/project-area/${id}/`,
    // Багийн бүрэлдэхүүн (ProjectMember) — үе шат + сум тус бүрээр
    members: (request_body) => `/api/n/project-member/?${request_body}`,
    memberCreate: () => `/api/n/project-member/`,
    memberDetail: (id) => `/api/n/project-member/${id}/`,
    findPerson: (register) =>
      `/api/n/project-member/find-person/?register=${encodeURIComponent(register)}`,
  },

  public: {
    menus: () => `/api/core/menus?pagination=false`,
    status: (year) =>
      `/api/point/status/?pagination=false&key=POINTSTATUS&year=${year}`,
    reports: (year) => `/api/client/reports/?pagination=false&year=${year}`,
    // Статистик: "Бүгд" үед year параметр илгээхгүй (бүх жилээр)
    stats: (year) => {
      const shouldFilterByYear =
        year &&
        !(typeof year === "string" && year.trim().toLowerCase() === "бүгд");
      const yearPart = shouldFilterByYear ? `&year=${year}` : "";
      return `/api/point/statistic/?pagination=false${yearPart}`;
    },
    timeline: (year) =>
      `/api/point/statistic/?pagination=false&key=TIMELINE&year=${year}`,
    purchase: (year) =>
      `/api/point/statistic/?pagination=false&key=PURCHASE&year=${year}`,
  },
  notification: {
    list: (params) => `/api/core/notification/?${params}`,
    edit: (id) => `/api/core/notification/${id}/`,
    create: `/api/core/notification/`,
    delete: (id) => `/api/core/notification/${id}/`,
    details: (id) => `/api/core/notification/${id}/`,
    dropdown: (params) => `/api/core/notification/?pagination=false&${params}`,
    bulkDelete: `/api/core/notification/bulk-delete/`,
    bulkRead: `/api/core/notification/bulk-read/`,
  },
  maillog: {
    list: (params) => `/api/core/maillog/?${params}`,
    details: (id) => `/api/core/maillog/${id}/`,
    delete: (id) => `/api/core/maillog/${id}/`,
    status: (params) => `/api/core/maillog/status/?${params}`,
    bulkDelete: `/api/core/maillog/bulk-delete/`,
  },

  access: {
    request: (request_body) => `/api/account/request/?${request_body}`,
    requestChart: (request_body) =>
      `/api/account/request/stats?${request_body}`,
    login: (request_body) => `/api/account/request/login?${request_body}`,
    actionChart: (request_body) =>
      `/api/account/status/action/?${request_body}`,
    userChart: (request_body) => `/api/account/status/user/?${request_body}`,
  },
  inquire: {
    check: (id) => `/api/point/inquire/act/${id}/`,
    payment: (id) => `/api/point/inquire/payment/${id}/`,
  },
};
