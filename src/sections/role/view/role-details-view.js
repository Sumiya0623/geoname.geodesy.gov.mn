"use client";
import { useGetRole } from "src/api/constant";
import { useGetMenusFordropdown } from "src/api/menu";
import RoleNewEditForm from "../role-new-edit-form";
export default function RoleDetailsView({ id }) {
  const { role } = useGetRole(id);
  const { menus } = useGetMenusFordropdown();
  return (
    <>
      <RoleNewEditForm currentRole={role} menus={menus} view />
    </>
  );
}
