

const ROOTS = {
  AUTH: "/auth",
  AUTH_DEMO: "/auth-demo",
  DASHBOARD: "/dashboard",
  SETTINGS: "/settings",
};

// ----------------------------------------------------------------------

export const paths = {
  comingSoon: "/coming-soon",
  maintenance: "/maintenance",
  pricing: "/pricing",
  payment: "/payment",
  about: "/about-us",
  contact: "/contact-us",
  faqs: "/faqs",
  page403: "/errors/403",
  page404: "/errors/404",
  page500: "/error/500",
  components: "/components",
  docs: "https://docs.minimals.cc",
  changelog: "https://docs.minimals.cc/changelog",

  // AUTH — систем дотор login/register хуудас байхгүй. Нэвтрэлт нь гадаад
  // геодези порталаар (NEXT_PUBLIC_PORTAL_URL / https://geodesy.gov.mn) явагдана.
  // authDemo: {
  //   classic: {
  //     login: `${ROOTS.AUTH_DEMO}/classic/login`,
  //     register: `${ROOTS.AUTH_DEMO}/classic/register`,
  //     forgotPassword: `${ROOTS.AUTH_DEMO}/classic/forgot-password`,
  //     newPassword: `${ROOTS.AUTH_DEMO}/classic/new-password`,
  //     verify: `${ROOTS.AUTH_DEMO}/classic/verify`,
  //   },
  //   modern: {
  //     login: `${ROOTS.AUTH_DEMO}/modern/login`,
  //     register: `${ROOTS.AUTH_DEMO}/modern/register`,
  //     forgotPassword: `${ROOTS.AUTH_DEMO}/modern/forgot-password`,
  //     newPassword: `${ROOTS.AUTH_DEMO}/modern/new-password`,
  //     verify: `${ROOTS.AUTH_DEMO}/modern/verify`,
  //   },
  // },
  // DASHBOARD
  dashboard: {
    root: ROOTS.DASHBOARD,
    mail: `${ROOTS.DASHBOARD}/mail`,
    chat: `${ROOTS.DASHBOARD}/chat`,
    blank: `${ROOTS.DASHBOARD}/blank`,
    kanban: `${ROOTS.DASHBOARD}/kanban`,
    calendar: `${ROOTS.DASHBOARD}/calendar`,
    fileManager: `${ROOTS.DASHBOARD}/file-manager`,
    permission: `${ROOTS.DASHBOARD}/permission`,

    geoserver: {
      root: `${ROOTS.DASHBOARD}/geoserver`,
      layers: (id) => `${ROOTS.DASHBOARD}/geoserver/${id}`,
      rules: (id) => `${ROOTS.DASHBOARD}/geoserver/layer/${id}`,
    },
    general: {
      app: `${ROOTS.DASHBOARD}/app`,
      ecommerce: `${ROOTS.DASHBOARD}/ecommerce`,
      analytics: `${ROOTS.DASHBOARD}/analytics`,
      banking: `${ROOTS.DASHBOARD}/banking`,
      booking: `${ROOTS.DASHBOARD}/booking`,
      file: `${ROOTS.DASHBOARD}/file`,
    },
    order: {
      root: `${ROOTS.DASHBOARD}/order`,
      details: (id) => `${ROOTS.DASHBOARD}/order/${id}`,
    },
    settings: {
      root: `${ROOTS.SETTINGS}`,
      system: `${ROOTS.SETTINGS}/system`,
      gis: `${ROOTS.SETTINGS}/gis`,
    },
    user: {
      root: `${ROOTS.SETTINGS}/user`,
      new: `${ROOTS.SETTINGS}/user/new`,
      list: `${ROOTS.SETTINGS}/user/list`,
      cards: `${ROOTS.SETTINGS}/user/cards`,
      profile: `${ROOTS.DASHBOARD}/profile`,
      account: `${ROOTS.SETTINGS}/user/account`,
      edit: (id) => `${ROOTS.SETTINGS}/user/${id}/edit`,
    },
    point: {
      root: `${ROOTS.DASHBOARD}/ready`,
      new: `${ROOTS.DASHBOARD}/ready/new`,
      details: (id) => `${ROOTS.DASHBOARD}/ready/${id}`,
      edit: (id) => `${ROOTS.DASHBOARD}/ready/${id}/edit`,
      count: {
        details: (id) => `${ROOTS.DASHBOARD}/count/${id}`,
        root: `${ROOTS.DASHBOARD}/count/`,
      },
    },
    menu: {
      root: `${ROOTS.SETTINGS}/menu`,
      new: `${ROOTS.SETTINGS}/menu/new`,
      details: (id) => `${ROOTS.SETTINGS}/menu/${id}`,
      edit: (id) => `${ROOTS.SETTINGS}/menu/${id}/edit`,
    },
    nl: {
      root: `${ROOTS.DASHBOARD}/nl`,
    },
    map: {
      root: `${ROOTS.DASHBOARD}/map`,
    },
    doc: {
      root: `${ROOTS.DASHBOARD}/doc`,
    },
    champaign: {
      root: `${ROOTS.DASHBOARD}/champaign`,
      details: (id) => `${ROOTS.DASHBOARD}/champaign/${id}`,
    },
    constant: {
      root: `${ROOTS.SETTINGS}/constant`,
    },
    nameclass: {
      root: `${ROOTS.DASHBOARD}/nameclass`,
    },
    legal: {
      root: `${ROOTS.DASHBOARD}/legal`,
    },
    request: {
      root: `${ROOTS.DASHBOARD}/request`,
    },
    geoname: {
      root: `${ROOTS.DASHBOARD}/geoname`,
    },
    name: {
      root: `${ROOTS.DASHBOARD}/name`,
      details: (id) => `${ROOTS.DASHBOARD}/name/${id}`,
    },
    role: {
      root: `${ROOTS.SETTINGS}/role`,
      new: `${ROOTS.SETTINGS}/role/new`,
      details: (id) => `${ROOTS.SETTINGS}/role/${id}`,
      edit: (id) => `${ROOTS.SETTINGS}/role/${id}/edit`,
    },
    level: {
      root: `${ROOTS.DASHBOARD}/level`,
      new: `${ROOTS.DASHBOARD}/level/new`,
      details: (id) => `${ROOTS.DASHBOARD}/level/${id}`,
      edit: (id) => `${ROOTS.DASHBOARD}/level/${id}/edit`,
    },
  },
};
