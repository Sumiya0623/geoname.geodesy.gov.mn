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
  chat: "/api/chat",
  kanban: "/api/kanban",
  calendar: "/api/calendar",
  auth: {
    logout: "/api/account/logout/",
    refresh: `/api/account/refresh/`,
  },
  mail: {
    list: "/api/mail/list",
    details: "/api/mail/details",
    labels: "/api/mail/labels",
  },
  post: {
    list: "/api/post/list",
    details: "/api/post/details",
    latest: "/api/post/latest",
    search: "/api/post/search",
  },
  product: {
    list: "/api/product/list",
    details: "/api/product/details",
    search: "/api/product/search",
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
    status: (request_body) => `/api/point/status/?${request_body}`,
    geoserverfields: (request_body) =>
      `/api/core/constant/geoserverfields/?pagination=false&${request_body}`,
  },

  nameclass: {
    list: (request_body) => `/api/core/constant/nameclass/?${request_body}`,
    create: `/api/core/constant/`,
    edit: (id) => `/api/core/constant/${id}/`,
    delete: (id) => `/api/core/constant/${id}/`,
    details: (id) => `/api/core/constant/${id}/`,
  },

  request: {
    list: (request_body) => `/api/r/request/?${request_body}`,
    create: `/api/r/request/`,
    edit: (id) => `/api/r/request/${id}/`,
    delete: (id) => `/api/r/request/${id}/`,
    details: (id) => `/api/r/request/${id}/`,
    geonames: (request_body) =>
      `/api/r/geoname/?pagination=false&${request_body}`,
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
  },

  legal: {
    types: (request_body) => `/api/r/legal-type/?${request_body}`,
    list: (request_body) => `/api/r/legal/?${request_body}`,
    create: `/api/r/legal/`,
    edit: (id) => `/api/r/legal/${id}/`,
    delete: (id) => `/api/r/legal/${id}/`,
    details: (id) => `/api/r/legal/${id}/`,
    units: (request_body) =>
      `/api/r/legal-unit/?pagination=false&${request_body}`,
  },

  network: {
    list: (request_body) => `/api/core/constant/?${request_body}`,
    edit: (id) => `/api/core/constant/${id}/`,
    create: `/api/core/constant/`,
    delete: (id) => `/api/core/constant/${id}/`,
    details: (id) => `/api/core/constant/${id}/`,
    dropdown: (request_body) =>
      `/api/core/constant/dropdown/?pagination=false&${request_body}`,
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
    gsCreateLayer: (id) => `/api/g/ws/${id}/gs-create-layer/`,
    gsUpdateLayer: (id) => `/api/g/ws/${id}/gs-update-layer/`,
    gsDeleteLayer: (id) => `/api/g/ws/${id}/gs-delete-layer/`,
  },
  point: {
    list: (request_body) => `/api/point/point/?${request_body}`,
    edit: (id) => `/api/point/point/${id}/`,
    create: `/api/point/point/`,
    delete: (id) => `/api/point/point/${id}/`,
    bulkDelete: `/api/point/point/bulk-delete/`,
    details: (id) => `/api/point/point/${id}/`,
    gpkg: `/api/point/point/gpkg/`,
    xls: `/api/point/point/xls/`,
    dropdown: (request_body) =>
      `/api/point/point/?pagination=false&${request_body}`,
    monpos: {
      list: (request_body) => `/api/point/monpos/?${request_body}`,
      import: `/api/point/monpos/data/`,
    },
    cart: {
      create: `/api/point/cart/`,
      edit: (id) => `/api/point/cart/${id}/`,
    },
    count: {
      list: (request_body) => `/api/point/count/?${request_body}`,
      edit: (id) => `/api/point/count/${id}/`,
      create: `/api/point/count/`,
      delete: (id) => `/api/point/count/${id}/`,
      details: (id) => `/api/point/count/${id}/`,
      approve: (id) => `/api/point/count/${id}/approve/`,
      // approve: (id) => `/api/point/approve/${id}/`,
    },
    nl: {
      list: (request_body) => `/api/point/chatlog/?${request_body}`,
      edit: (id) => `/api/point/chatlog/${id}/`,
      create: `/api/point/chatlog/`,
      delete: (id) => `/api/point/chatlog/${id}/`,
      details: (id) => `/api/point/chatlog/${id}/`,
      intent: (request_body) => `/api/point/chatlog/intent/?${request_body}`,
    },
    merge: `/api/point/point/merge/`,
  },
  measurement: {
    list: (request_body) => `/api/point/measurement/?${request_body}`,
    edit: (id) => `/api/point/measurement/${id}/`,
    create: `/api/point/measurement/`,
    delete: (id) => `/api/point/measurement/${id}/`,
    details: (id) => `/api/point/measurement/${id}/`,
    dropdown: (request_body) =>
      `/api/point/measurement/?pagination=false&${request_body}`,
    nl: `/api/point/chat/nl-search/`,
  },
  report: {
    list: (request_body) => `/api/point/report/?${request_body}`,
  },
  act: {
    list: (request_body) => `/api/point/act/?${request_body}`,
    edit: (id) => `/api/point/act/${id}/`,
    create: `/api/point/act/`,
    delete: (id) => `/api/point/act/${id}/`,
    details: (id) => `/api/point/act/${id}/`,
    accept: (id) => `/api/point/act/${id}/accept/`,
    decline: (id) => `/api/point/act/${id}/decline/`,
    download: (id) => `/api/point/act/${id}/download/`,
    dropdown: (request_body) =>
      `/api/point/act/dropdown/?pagination=false&${request_body}`,
  },
  number: {
    list: (request_body) => `/api/point/number/?${request_body}`,
    edit: (id) => `/api/point/number/${id}/`,
    create: `/api/point/number/`,
    delete: (id) => `/api/point/number/${id}/`,
    details: (id) => `/api/point/number/${id}/`,
    dropdown: (request_body) =>
      `/api/point/number/dropdown/?pagination=false&${request_body}`,
  },
  unit: {
    list: (request_body) => `/api/point/unit/?${request_body}`,
    edit: (id) => `/api/point/unit/${id}/`,
    create: `/api/point/unit/`,
    delete: (id) => `/api/point/unit/${id}/`,
    details: (id) => `/api/point/unit/${id}/`,
    dropdown: (request_body) =>
      `/api/point/unit/dropdown/?pagination=false&${request_body}`,
  },
  nameCategory: {
    list: (request_body) => `/api/m/namecategory/?${request_body}`,
    locate: (request_body) => `/api/m/namecategory/locate/?${request_body}`,
  },
  order: {
    me: "/api/point/cart/me/",
    add: "/api/point/cart/add/",
    remove: "/api/point/cart/remove/",
    list: (request_body) => `/api/point/cart/?${request_body}`,
    edit: (id) => `/api/point/cart/${id}/`,
    delete: (id) => `/api/point/cart/${id}/`,
    details: (id) => `/api/point/cart/${id}/`,
    dropdown: (request_body) =>
      `/api/point/cart/?pagination=false&${request_body}`,
    pay: `/api/point/cart/payment/`,
    check: (id) => `/api/point/check/?payment_id=${id}`,
    download: (id) => `/api/point/cart/${id}/download/`,
  },

  geoserver: {
    list: (request_body) => `/api/geoserver/geoserver/?${request_body}`,
    edit: (id) => `/api/geoserver/geoserver/${id}/`,
    create: `/api/geoserver/geoserver/`,
    delete: (id) => `/api/geoserver/geoserver/${id}/`,
    details: (id) => `/api/geoserver/geoserver/${id}/`,
    remove: (id) => `/api/geoserver/geoserver/remove/${id}/`,
    dropdown: (request_body) =>
      `/api/geoserver/geoserver/dropdown/?pagination=false&${request_body}`,
    layer: {
      list: (request_body) => `/api/geoserver/fs/?${request_body}`,
      edit: (id) => `/api/geoserver/fs/${id}/`,
      create: `/api/geoserver/fs/`,
      delete: (id) => `/api/geoserver/fs/${id}/`,
      details: (id) => `/api/geoserver/fs/${id}/`,
      remove: (id) => `/api/geoserver/fs/remove/${id}/`,
      geoserver: (request_body) =>
        `/api/geoserver/fs/geoserver/?${request_body}`,

      attributes: (request_body) =>
        `/api/geoserver/fs/attributes/?${request_body}`,
      stylefields: (request_body) =>
        `/api/geoserver/fs/stylefields/?${request_body}`,
      baseLayers: `/api/geoserver/fs/baselayers/`,
    },
    style: {
      list: (request_body) => `/api/geoserver/style/?${request_body}`,
      edit: (id) => `/api/geoserver/style/${id}/`,
      create: `/api/geoserver/style/`,
      delete: (id) => `/api/geoserver/style/${id}/`,
      details: (id) => `/api/geoserver/style/${id}/`,
      rule: {
        list: (request_body) => `/api/geoserver/rule/?${request_body}`,
        edit: (id) => `/api/geoserver/rule/${id}/`,
        create: `/api/geoserver/rule/`,
        delete: (id) => `/api/geoserver/rule/${id}/`,
        details: (id) => `/api/geoserver/rule/${id}/`,
        iconPreview: (svg) =>
          `/api/geoserver/rule/icon/${encodeURIComponent(svg)}`,
      },
    },

    group: {
      list: (request_body) => `/api/geoserver/group/?${request_body}`,
      edit: (id) => `/api/geoserver/group/${id}/`,
      create: `/api/geoserver/group/`,
      delete: (id) => `/api/geoserver/group/${id}/`,
      details: (id) => `/api/geoserver/group/${id}/`,
    },
    geoserver: (request_body) => `/api/geoserver/fs/geoserver/?${request_body}`,
  },
  status: {
    list: (request_body) => `/api/point/status/?${request_body}`,
  },
  geofile: {
    list: (request_body) => `/api/name/geofile/?${request_body}`,
    edit: (id) => `/api/name/geofile/${id}/`,
    create: `/api/name/geofile/`,
    delete: (id) => `/api/name/geofile/${id}/`,
    details: (id) => `/api/name/geofile/${id}/`,
    dropdown: (request_body) =>
      `/api/name/geofile/dropdown/?pagination=false&${request_body}`,
  },

  user: {
    list: (request_body) => `/api/core/user/?${request_body}`,
    info: `/api/core/user/me/`,
    logout: `/api/core/user/logout/`,
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
    list: (request_body) => `/api/account/project/?${request_body}`,
    details: (id) => `/api/account/project/${id}/`,
    sync: (request_body = "") => `/api/account/project/sync/?${request_body}`,
    dropdown: (params) => `/api/account/project/?pagination=false${params}`,
  },

  companies: {
    list: () => `/api/client/companies`,
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
  pointFilter: {
    nomek: (request_body) => `/api/point/nomek/registered/?${request_body}`,
    systemreg: (request_body) =>
      `/api/core/constant/system-registered/?${request_body}`,
    networkreg: (request_body) =>
      `/api/core/constant/network-registered/?${request_body}`,
    unit: (request_body) => `/api/point/unit/registered/?${request_body}`,
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
