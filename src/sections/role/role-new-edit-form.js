import * as Yup from "yup";
import PropTypes from "prop-types";
import { useForm } from "react-hook-form";
import { useMemo, useState, useEffect } from "react";
import { yupResolver } from "@hookform/resolvers/yup";

import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import LoadingButton from "@mui/lab/LoadingButton";
import {
  Box,
  List,
  Checkbox,
  Collapse,
  ListItem,
  ListItemText,
  ListItemButton,
} from "@mui/material";

import { paths } from "src/routes/paths";
import { useRouter } from "src/routes/hooks";
import { requiredMsg } from "src/utils/regex";
import axiosInstance, { endpoints } from "src/utils/axios";
import Iconify from "src/components/iconify";
import { useSnackbar } from "src/components/snackbar";
import FormProvider, { RHFTextField } from "src/components/hook-form";

// ----------------------------------------------------------------------

export default function RoleNewEditForm({
  currentRole,
  menus,
  view = false,
  onCloseForm,
  refetch,
}) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [openMenus, setOpenMenus] = useState({});
  const [openSubMenus, setOpenSubMenus] = useState({});
  const [selectedActionIds, setSelectedActionIds] = useState([]);

  const toggleMenu = (id) => {
    setOpenMenus((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const toggleSubMenu = (id) => {
    setOpenSubMenus((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCheckboxChange = (actionId) => {
    setSelectedActionIds((prev) =>
      prev.includes(actionId)
        ? prev.filter((id) => id !== actionId)
        : [...prev, actionId],
    );
  };

  const NewRoleSchema = Yup.object().shape({
    name: Yup.string().required(requiredMsg),
  });

  const defaultValues = useMemo(
    () => ({
      id: currentRole?.id || "",
      name: currentRole?.name || "",
    }),
    [currentRole],
  );

  const methods = useForm({
    resolver: yupResolver(NewRoleSchema),
    defaultValues,
  });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    if (currentRole) {
      reset(defaultValues);
      setSelectedActionIds(currentRole?.actions || []);
    }
  }, [currentRole, defaultValues, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const { id, name } = data;
    const request_body = {
      name,
      key: "ROLES",
      actions: selectedActionIds,
    };
    const method = currentRole ? "put" : "post";
    const URL = currentRole
      ? endpoints.constant.edit(id)
      : endpoints.constant.create;
    try {
      const response = await axiosInstance[method](URL, request_body);
      if (response.status === 200 || response.status === 201) {
        enqueueSnackbar(
          `Эрх амжилттай ${currentRole ? "өөрчлөгдлөө" : "нэмэгдлээ"}`,
        );
        // Inline (таб доторх) горимд хуудас солихгүйгээр жагсаалтаа шинэчилж,
        // формоо хаана. Бусад үед хуучин урсгалаар жагсаалт руу шилжинэ.
        if (onCloseForm) {
          refetch?.();
          onCloseForm();
        } else {
          router.push(paths.dashboard.role.root);
        }
      }
      reset();
    } catch (error) {
      enqueueSnackbar(
        `Эрхийг ${currentRole ? "өөрчлөх" : "үүсгэх"} үед алдаа гарлаа`,
        {
          variant: "error",
        },
      );
    }
  });

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Card sx={{ p: 3 }}>
        <Box
          rowGap={3}
          columnGap={2}
          display="grid"
          gridTemplateColumns={{
            xs: "repeat(1, 1fr)",
            sm: "repeat(2, 1fr)",
          }}
        >
          <RHFTextField name="name" label="Нэр" disabled={view} />
        </Box>

        <Box>
          <List>
            {menus?.map((menu) => (
              <div key={menu.id}>
                {/* Menu Item */}
                <ListItemButton onClick={() => toggleMenu(menu.id)}>
                  <ListItemText primary={menu.name} />
                  <Iconify
                    icon="eva:arrow-ios-downward-fill"
                    sx={{
                      transition: (theme) =>
                        theme.transitions.create("transform"),
                      ...(openMenus[menu.id] && {
                        transform: "rotate(-180deg)",
                      }),
                    }}
                  />
                </ListItemButton>

                <Collapse in={openMenus[menu.id]} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding sx={{ pl: 2 }}>
                    {menu.children.map((submenu) => (
                      <div key={submenu.id}>
                        <ListItemButton
                          onClick={() => toggleSubMenu(submenu.id)}
                        >
                          <ListItemText primary={submenu.name} />
                          <Iconify
                            icon="eva:arrow-ios-downward-fill"
                            sx={{
                              transition: (theme) =>
                                theme.transitions.create("transform"),
                              ...(openSubMenus[submenu.id] && {
                                transform: "rotate(-180deg)",
                              }),
                            }}
                          />
                        </ListItemButton>
                        <Collapse
                          in={openSubMenus[submenu.id]}
                          timeout="auto"
                          unmountOnExit
                        >
                          <List component="div" disablePadding sx={{ pl: 4 }}>
                            {submenu.actions?.map((action) => (
                              <ListItem key={action.id} disablePadding>
                                <Checkbox
                                  disabled={view}
                                  checked={selectedActionIds.includes(
                                    action.id,
                                  )}
                                  onChange={() =>
                                    handleCheckboxChange(action.id)
                                  }
                                />

                                <ListItemText primary={action.name} />
                              </ListItem>
                            ))}
                          </List>
                        </Collapse>
                      </div>
                    ))}
                  </List>
                </Collapse>
              </div>
            ))}
          </List>
        </Box>
      </Card>

      {!view && (
        <Stack alignItems="flex-end" sx={{ mt: 3 }}>
          <LoadingButton
            type="submit"
            color="primary"
            variant="contained"
            loading={isSubmitting}
          >
            {currentRole ? "хадгалах" : "нэмэх"}
          </LoadingButton>
        </Stack>
      )}
    </FormProvider>
  );
}

RoleNewEditForm.propTypes = {
  view: PropTypes.bool,
  menus: PropTypes.array,
  currentRole: PropTypes.object,
  onCloseForm: PropTypes.func,
  refetch: PropTypes.func,
};
