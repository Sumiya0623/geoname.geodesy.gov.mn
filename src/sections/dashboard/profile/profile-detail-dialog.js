import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Typography,
  Box,
  TextField,
  CircularProgress,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Chip,
} from "@mui/material";
import { CloseOutlined } from "@mui/icons-material";
import { enqueueSnackbar } from "notistack";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useAuthContext } from "src/auth/auth-context";
import { useGetuserJobsFordropdown } from "src/api/user-job";

function ProfileDetailDialog({ open, onClose, refresh }) {
  const { user, refresh: localRefresh } = useAuthContext();
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isValidEmail, setIsValidEmail] = useState(true);
  const [isValidPhone, setIsValidPhone] = useState(true);
  const fileInputRef = React.useRef(null);

  const [syncLoading, setSyncLoading] = useState(false);
  async function syncEmployment() {
    setSyncLoading(true);
    try {
      enqueueSnackbar(`Ажил эрхлэлтийн мэдээлэл шинэчлэгдэж байна...`, {
        variant: "info",
      });
      const response = await axiosInstance.get(endpoints.userJob.sync);
      if (response?.status === 200) {
        await UserJobsMutation();
        enqueueSnackbar(`Ажил эрхлэлтийн мэдээлэл амжилттай шинэчлэгдлээ`);
      }
    } catch (error) {
      enqueueSnackbar(
        error?.message ||
          "Ажил эрхлэлтийн мэдээллийг шинэчлэх үед алдаа гарлаа",
        {
          variant: error?.message ? "warning" : "error",
        },
      );
    } finally {
      setSyncLoading(false);
    }
  }

  const { userJobs, userJobsEmpty, userJobsLoading } =
    useGetuserJobsFordropdown();

  React.useEffect(() => {
    if (user) {
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setIsValidEmail(true);
      setIsValidPhone(true);
      setSelectedPhoto(null);
    }
  }, [user]);

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    setIsValidEmail(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value;
    setPhone(value);
    setIsValidPhone(
      user?.is_citizen ? /^\d{8}$/.test(value) : /^(\d{6}|\d{8})$/.test(value),
    );
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedPhoto(file);
    }
  };

  const saveEmail = async (val) => {
    try {
      const res = await axiosInstance.post("/api/core/user/confirm/", {
        email: val.toLowerCase(),
      });
      if (res?.status === 200) {
        return {
          success: true,
          message: "Email баталгаажуулалтын холбоос илгээгдлээ",
        };
      } else {
        return {
          success: false,
          message: res?.data?.results || "Email хадгалахад алдаа гарлаа",
        };
      }
    } catch (err) {
      return {
        success: false,
        message: err?.response?.data?.detail || "Email хадгалахад алдаа гарлаа",
      };
    }
  };

  const savePhone = async (val) => {
    try {
      const res = await axiosInstance.patch(`/api/core/user/${user?.id}/`, {
        phone: val,
      });
      if (res?.status === 200) {
        return { success: true, message: "Утасны дугаар амжилттай солигдлоо" };
      } else {
        return {
          success: false,
          message:
            res?.data?.detail ||
            res?.data?.results ||
            "Утасны дугаар хадгалахад алдаа гарлаа",
        };
      }
    } catch (err) {
      return {
        success: false,
        message:
          err?.response?.data?.detail ||
          "Утасны дугаар хадгалахад алдаа гарлаа",
      };
    }
  };

  const updateJob = async (jobId) => {
    try {
      const request_body = {
        is_working: true,
      };
      const URL = endpoints.userJob.edit(jobId);
      const response = await axiosInstance.patch(URL, request_body);
      if ([200, 201].includes(response.status)) {
        return {
          success: true,
          message: "Ажил эрхлэлт амжилттай шинэчлэгдлээ",
        };
      } else {
        return {
          success: false,
          message: "Ажил эрхлэлт шинэчлэх үед алдаа гарлаа",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Ажил эрхлэлт шинэчлэх үед алдаа гарлаа",
      };
    }
  };

  const savePhoto = async (photoFile) => {
    try {
      const formData = new FormData();
      formData.append("id", String(user.id));
      formData.append("photo", photoFile);

      const url = endpoints.user.edit(user.id);
      const response = await axiosInstance.patch(url, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if ([200, 201].includes(response.status)) {
        if (fileInputRef.current) fileInputRef.current.value = "";
        return { success: true, message: "Зураг амжилттай хадгалагдлаа" };
      } else {
        return { success: false, message: "Зураг хадгалахад алдаа гарлаа" };
      }
    } catch (error) {
      return { success: false, message: "Зураг хадгалахад алдаа гарлаа" };
    }
  };

  const handleSave = async () => {
    const emailChanged = email !== user?.email;
    const phoneChanged = phone !== user?.phone;
    const jobSelected = selectedJob;
    const photoSelected = selectedPhoto && !user?.is_citizen;

    if (!emailChanged && !phoneChanged && !jobSelected && !photoSelected) {
      if (email && !user?.is_email_confirmed) {
        setLoading(true);
        try {
          const result = await saveEmail(email);
          if (result.success) {
            enqueueSnackbar(
              result?.message || "Email баталгаажуулалтын холбоос илгээгдлээ",
              { variant: "success" },
            );
          } else {
            enqueueSnackbar(result?.message, { variant: "error" });
          }
        } catch (error) {
          enqueueSnackbar("Email баталгаажуулалт илгээхэд алдаа гарлаа", {
            variant: "error",
          });
        } finally {
          setLoading(false);
        }
      }
      onClose();
      return;
    }

    setLoading(true);
    const promises = [];
    const actions = [];

    if (emailChanged && isValidEmail) {
      promises.push(saveEmail(email));
      actions.push("Email");
    }

    if (phoneChanged && isValidPhone) {
      promises.push(savePhone(phone));
      actions.push("Утас");
    }

    if (jobSelected) {
      promises.push(updateJob(jobSelected));
      actions.push("Ажил");
    }

    if (photoSelected) {
      promises.push(savePhoto(selectedPhoto));
      actions.push("Зураг");
    }

    try {
      const results = await Promise.all(promises);
      const successfulResults = results.filter((result) => result.success);
      const failedResults = results.filter((result) => !result.success);

      if (successfulResults.length === results.length) {
        if (actions.length === 1) {
          enqueueSnackbar(successfulResults[0].message, { variant: "success" });
        } else {
          enqueueSnackbar(`${actions.join(", ")} амжилттай хадгалагдлаа`, {
            variant: "success",
          });
        }
        localRefresh();
        refresh();
        onClose();
      } else if (successfulResults.length > 0) {
        const successActions = actions.filter(
          (_, index) => results[index].success,
        );
        const failActions = actions.filter(
          (_, index) => !results[index].success,
        );
        enqueueSnackbar(
          `${successActions.join(", ")} амжилттай хадгалагдлаа. ${failActions.join(", ")} хадгалагдсангүй.`,
          { variant: "warning" },
        );
        localRefresh();
        refresh();
      } else {
        enqueueSnackbar(
          failedResults.length === 1
            ? failedResults[0].message
            : "Мэдээлэл хадгалагдсангүй",
          { variant: "error" },
        );
      }
    } catch (error) {
      enqueueSnackbar("Мэдээлэл хадгалахад алдаа гарлаа", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box>
          <Typography variant="h6">Хувийн мэдээлэл</Typography>
          <Alert severity="info">
            Дэд системүүдийг ашиглахад таны хувийн мэдээлэл шаардлагатай тул та
            энэ хэсгийг бөглөнө үү.
          </Alert>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseOutlined fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ py: 1 }}>
          {user ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {!email && (
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  fullWidth
                  variant="outlined"
                  disabled={loading}
                  error={email?.length > 0 && !isValidEmail}
                  helperText={
                    !isValidEmail && email ? "Та зөв мэйл хаяг оруулна уу" : " "
                  }
                />
              )}
              {!user?.is_email_confirmed && (
                <Alert severity="warning">
                  Таны мэйл хаяг баталгаажаагүй байна. Хадгалах товчыг дарснаар
                  баталгаажуулах холбоос илгээгдэнэ.
                </Alert>
              )}
              {!phone && (
                <TextField
                  label="Утасны дугаар"
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  fullWidth
                  variant="outlined"
                  disabled={loading}
                  error={phone?.length > 0 && !isValidPhone}
                  helperText={
                    !isValidPhone && phone
                      ? "Та зөв утасны дугаар оруулна уу"
                      : " "
                  }
                />
              )}
              {!user?.is_citizen ? (
                <Box>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                    id="photo-upload"
                  />
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Button
                      variant="outlined"
                      component="label"
                      htmlFor="photo-upload"
                      disabled={loading}
                      sx={{ minWidth: 120 }}
                    >
                      Зураг сонгох
                    </Button>
                    {selectedPhoto && (
                      <Typography variant="body2" color="text.secondary">
                        {selectedPhoto.name}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ) : (
                <Box>
                  <FormControl
                    fullWidth
                    variant="outlined"
                    disabled={loading || userJobsLoading}
                  >
                    <InputLabel>Үндсэн ажил</InputLabel>
                    <Select
                      value={selectedJob || ""}
                      onChange={(e) => setSelectedJob(e.target.value)}
                      label="Үндсэн ажил"
                    >
                      <MenuItem value="">
                        <em>Ажил сонгоно уу</em>
                      </MenuItem>
                      {userJobs?.map((job) => (
                        <MenuItem key={job.id} value={job.id}>
                          <Typography variant="body2">
                            {job?.owner?.full_name}
                          </Typography>
                          {job?.is_working && (
                            <Chip
                              size="small"
                              label="Үндсэн"
                              sx={{
                                bgcolor: "success.dark",
                                color: "common.white",
                                ml: 1,
                              }}
                            />
                          )}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {userJobsLoading && (
                    <Typography variant="body2" color="text.secondary">
                      Ажлын мэдээлэл ачааллаж байна...
                    </Typography>
                  )}
                  {userJobsEmpty && !userJobsLoading && (
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 1,
                        p: 2,
                        border: "1px dashed",
                        borderColor: "divider",
                        borderRadius: 1,
                      }}
                    >
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        align="center"
                      >
                        Ажлын мэдээлэл олдсонгүй
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={syncLoading}
                        onClick={() => {
                          syncEmployment();
                        }}
                        sx={{ mt: 1 }}
                      >
                        НД мэдээлэл шинэчлэх
                      </Button>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Мэдээлэл олдсонгүй
            </Typography>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={
            loading ||
            (email !== user?.email && !isValidEmail) ||
            (phone !== user?.phone && !isValidPhone)
          }
          startIcon={loading && <CircularProgress size={16} />}
        >
          {loading ? "Хадгалж байна..." : "Хадгалах"}
        </Button>
        <Button variant="outlined" onClick={onClose} disabled={loading}>
          Буцах
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ProfileDetailDialog;
