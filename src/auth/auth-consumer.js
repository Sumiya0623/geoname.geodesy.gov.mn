"use client";

import PropTypes from "prop-types";
import { useAuthContext } from "./auth-context";
import { SplashScreen } from "src/components/loading-screen";

export function AuthConsumer({ children }) {
  const { loading } = useAuthContext();
  if (loading) return <SplashScreen />;
  return <>{children}</>;
}

AuthConsumer.propTypes = {
  children: PropTypes.node,
};
