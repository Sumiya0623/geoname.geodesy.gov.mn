'use server'
export const apilist = {
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
    menus: (request_body) =>
      `/api/core/constant/menus/?pagination=false&${request_body}`,
    systemreg: `/api/core/constant/system-registered/`,
    networkreg: `/api/core/constant/network-registered/`,
    status: (request_body) => `/api/point/status/?${request_body}`,
    geoserverfields: (request_body) =>
      `/api/core/constant/geoserverfields/?pagination=false&${request_body}`,
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
    list: (request_body) => `/api/point/champaign/?${request_body}`,
    details: (id) => `/api/point/champaign/${id}/`,
    dropdown: (params) => `/api/point/champaign/?pagination=false${params}`,
    act: {
      list: (request_body) => `/api/point/act/?${request_body}`,
      edit: (id) => `/api/point/act/${id}/`,
      create: `/api/point/act/`,
      delete: (id) => `/api/point/act/${id}/`,
      details: (id) => `/api/point/act/${id}/`,
      dropdown: (request_body) =>
        `/api/point/act/dropdown/?pagination=false&${request_body}`,
    },
  },

  companies: {
    list: () => `/api/client/companies`,
  },
  public: {
    menus: () => `/api/core/menus?pagination=false`,
    status: (year) =>
      `/api/point/status/?pagination=false&key=POINTSTATUS&year=${year}`,
    reports: (year) => `/api/client/reports/?pagination=false&year=${year}`,
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
  },
};
