"use client";

import PropTypes from "prop-types";
import { useRouter } from "next/navigation";
import { useMemo, useEffect, useReducer, useCallback } from "react";

import axiosInstance, { endpoints } from "src/utils/axios";
import { AuthContext } from "./auth-context";

const initialState = {
  user: null,
  loading: true,
};

function reducer(state, action) {
  switch (action.type) {
    case "INITIAL":
      return { user: action.payload.user, loading: false };
    case "LOGOUT":
      return { user: null, loading: false };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const router = useRouter();

  const initialize = useCallback(async () => {
    try {
      const response = await axiosInstance.get(endpoints.user.info);

      dispatch({ type: "INITIAL", payload: { user: response.data } });
    } catch (error) {
      dispatch({ type: "INITIAL", payload: { user: null } });
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const logout = useCallback(async () => {
    try {
      await axiosInstance.post(endpoints.user.logout);
    } catch (e) {}
    localStorage.removeItem("accessToken");
    delete axiosInstance.defaults.headers.common.Authorization;
    dispatch({ type: "LOGOUT" });
    router.replace(process.env.NEXT_PUBLIC_PORTAL_URL);
    router.refresh();
  }, [router]);

  const status = state.loading
    ? "loading"
    : state.user
      ? "authenticated"
      : "unauthenticated";

  const value = useMemo(
    () => ({
      user: state.user,
      loading: status === "loading",
      authenticated: status === "authenticated",
      unauthenticated: status === "unauthenticated",
      logout,
    }),
    [state.user, status, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = {
  children: PropTypes.node,
};
