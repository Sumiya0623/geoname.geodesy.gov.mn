import "src/global.css";

// i18n
import "src/locales/i18n";

// import 'ol-layerswitcher/dist/ol-layerswitcher.css';
// import 'ol/ol.css';
// import 'ol-ext/dist/ol-ext.css';
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination"; // Make sure pagination is also imported
// ----------------------------------------------------------------------

import PropTypes from "prop-types";

import { LocalizationProvider } from "src/locales";

import ThemeProvider from "src/theme";
import { primaryFont } from "src/theme/typography";

import ProgressBar from "src/components/progress-bar";
import { MotionLazy } from "src/components/animate/motion-lazy";
import SnackbarProvider from "src/components/snackbar/snackbar-provider";
import { SettingsDrawer, SettingsProvider } from "src/components/settings";

import { AuthProvider } from "src/auth/context/jwt";
import { NextStepProvider } from "nextstepjs";

export const viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata = {
  title: "Газар зүйн нэрийн дэд систем",
  description: "",
  keywords: "react,material,kit,application,dashboard,admin,template",
  manifest: "/manifest.json",
  icons: [
    { rel: "icon", url: "/assets/logo/logo.svg" },
    {
      rel: "icon",
      type: "image/png",
      sizes: "16x16",
      url: "/assets/logo/logo.svg",
    },
    {
      rel: "icon",
      type: "image/png",
      sizes: "32x32",
      url: "/assets/logo/logo.svg",
    },
    { rel: "apple-touch-icon", sizes: "180x180", url: "/assets/logo/logo.svg" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={primaryFont.className}>
      <body>
        <AuthProvider>
          <LocalizationProvider>
            <SettingsProvider
              defaultSettings={{
                themeMode: "light", // 'light' | 'dark'
                themeDirection: "ltr", //  'rtl' | 'ltr'
                themeContrast: "default", // 'default' | 'bold'
                themeLayout: "vertical", // 'vertical' | 'horizontal' | 'mini'
                themeColorPresets: "blue", // 'default' | 'cyan' | 'purple' | 'blue' | 'orange' | 'red'
                themeStretch: false,
              }}
            >
              <ThemeProvider>
                <MotionLazy>
                  <SnackbarProvider>
                    <SettingsDrawer />
                    <ProgressBar />
                    <NextStepProvider>{children}</NextStepProvider>
                  </SnackbarProvider>
                </MotionLazy>
              </ThemeProvider>
            </SettingsProvider>
          </LocalizationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

RootLayout.propTypes = {
  children: PropTypes.node,
};
