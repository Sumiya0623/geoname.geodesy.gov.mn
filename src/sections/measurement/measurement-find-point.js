import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  CircularProgress,
  Chip,
  Tooltip,
  Stack,
  Collapse,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Tabs,
  Tab,
  TablePagination,
} from "@mui/material";
import {
  Search as SearchIcon,
  Close as CloseIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TableChart as TableChartIcon,
  Map as MapIcon,
} from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { useGetPoints } from "src/api/point";
import {
  useGetConstantsFordropdown,
  useGetConstantsForParent,
} from "src/api/constant";
import PointsMap from "src/components/map/PointsMap";

const MeasurementFindPoint = ({
  open,
  onClose,
  onSelectPoint,
  title = "Цэг хайх",
}) => {
  const { enqueueSnackbar } = useSnackbar();

  const [formData, setFormData] = useState({
    number: "",
    name: "",
    network: "",
    class_in: "",
    status_id: "",
    center_type: "",
    approximate_x: "",
    approximate_y: "",
    approximate_z: "",
  });

  const [searchFilters, setSearchFilters] = useState({});
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0 = table, 1 = map
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // API hooks
  const queryParams = useMemo(() => {
    const { class_in, ...rest } = searchFilters;
    const params = {
      ...rest,
      page: page + 1,
      page_size: rowsPerPage,
    };
    return params;
  }, [searchFilters, page, rowsPerPage]);

  const {
    points: searchResults = [],
    pointsError: error,
    pointsMutation: mutate,
    pointsLoading: loading,
    pointsCount: totalCount = 0,
  } = useGetPoints(queryParams);

  const { constants: networkTypesData } =
    useGetConstantsFordropdown("GEODETIC_NETWORK");
  const { constants: statusTypesData } =
    useGetConstantsFordropdown("POINTSTATUS");
  const { constants: centerTypesData } =
    useGetConstantsFordropdown("CenterType");

  const networkParents = useMemo(
    () => (networkTypesData || []).filter((option) => !option.parent),
    [networkTypesData]
  );

  const selectedNetworkParent = formData.network || null;

  const normalizedParentId = useMemo(() => {
    if (!selectedNetworkParent) return null;
    const numeric = Number(selectedNetworkParent);
    return Number.isNaN(numeric) ? selectedNetworkParent : numeric;
  }, [selectedNetworkParent]);

  const { constants: networkChildOptions = [] } =
    useGetConstantsForParent(normalizedParentId);

  const statusTypes = statusTypesData || [];
  const centerTypes = centerTypesData || [];


  const handleConfirmSelection = useCallback(() => {
    if (selectedPoint && onSelectPoint) {
      onSelectPoint(selectedPoint);
      enqueueSnackbar("Цэг амжилттай сонгогдлоо", { variant: "success" });
      onClose();
    } else {
      enqueueSnackbar("Цэг сонгоогүй байна", { variant: "warning" });
    }
  }, [selectedPoint, onSelectPoint, enqueueSnackbar, onClose]);
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!open) return;

      if (event.key === "Enter" && selectedPoint) {
        event.preventDefault();
        handleConfirmSelection();
      } else if (event.key === "Escape") {
        event.preventDefault();
        if (selectedPoint) {
          setSelectedPoint(null);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, selectedPoint, onClose, handleConfirmSelection]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      if (name === "network") {
        next.class_in = "";
      }

      return next;
    });
  };

  const handleSearch = () => {
    const activeFilters = Object.entries(formData)
      .filter(
        ([key, value]) => value !== "" && value !== null && value !== undefined
      )
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    if (Object.keys(activeFilters).length === 0) {
      enqueueSnackbar("Хайлтын шалгуур оруулна уу", { variant: "warning" });
      return;
    }

    setSearchFilters(activeFilters);
    setHasSearched(true);
    setSelectedPoint(null);
    setActiveTab(0); // Reset to table view
    setPage(0);
  };

  const getActiveFilterCount = () => {
    return Object.values(formData).filter(
      (value) => value !== "" && value !== null && value !== undefined
    ).length;
  };

  const handleClearAllFilters = () => {
    setFormData({
      number: "",
      name: "",
      network: "",
      class_in: "",
      status_id: "",
      center_type: "",
      approximate_x: "",
      approximate_y: "",
      approximate_z: "",
    });
  };

  const handlePointSelection = (point) => {
    setSelectedPoint(selectedPoint?.id === point.id ? null : point);
  };

  const handleQuickSelection = (point) => {
    setSelectedPoint(point);
    if (onSelectPoint) {
      onSelectPoint(point);
      enqueueSnackbar("Цэг амжилттай сонгогдлоо", { variant: "success" });
      onClose();
    }
  };

  const handleReset = () => {
    handleClearAllFilters();
    setSearchFilters({});
    setHasSearched(false);
    setSelectedPoint(null);
    setShowAdvancedFilters(false);
    setShowCoordinates(false);
    setActiveTab(0);
    setPage(0);
  };

  useEffect(() => {
    if (!hasSearched) return;
    if (loading) return;

    const lastPage = Math.max(
      0,
      Math.ceil((totalCount || 0) / rowsPerPage) - 1
    );

    setPage((prevPage) => {
      if (totalCount === 0) {
        return 0;
      }
      return prevPage > lastPage ? lastPage : prevPage;
    });
  }, [hasSearched, loading, totalCount, rowsPerPage]);

  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback((event) => {
    const nextRowsPerPage = parseInt(event.target.value, 10) || 10;
    setRowsPerPage(nextRowsPerPage);
    setPage(0);
  }, []);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow:
            "rgba(0, 0, 0, 0.05) 0px 6px 24px 0px, rgba(0, 0, 0, 0.08) 0px 0px 0px 1px",
          height: "90vh",
          maxHeight: "90vh",
          backgroundColor: "#fafafa",
          overflow: "hidden",
        },
      }}
    >
      <DialogTitle
        sx={{
          m: 0,
          p: 0,
          backgroundColor: "white",
          borderBottom: "1px solid #e0e0e0",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: 2,
                padding: 2,
                backgroundColor: "#f5f5f5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #e0e0e0",
              }}
            >
              <SearchIcon sx={{ color: "#1976d2", fontSize: 24 }} />
            </Box>
            <Box>
              <Typography
                variant="h5"
                sx={{ fontWeight: 600, color: "#212121", mb: 0.5 }}
              >
                {title}
              </Typography>
            </Box>
          </Box>
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{
              color: "#757575",
              "&:hover": {
                backgroundColor: "#f5f5f5",
                color: "#424242",
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent
        sx={{
          height: "calc(90vh - 140px)",
          backgroundColor: "#fafafa",
          p: 0,
          overflow: "hidden",
        }}
      >
        <Box sx={{ display: "flex", height: "100%", width: "100%" }}>
          <Box
            sx={{
              width: 400,
              backgroundColor: "white",
              borderRight: "1px solid #e0e0e0",
              p: 3,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <FilterListIcon sx={{ color: "#1976d2", mr: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Шүүлтүүр
                </Typography>
              </Box>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Box sx={{ display: "flex", gap: 1 }}>
                  {getActiveFilterCount() > 0 && (
                    <Chip
                      label={`${getActiveFilterCount()}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  )}
                  {getActiveFilterCount() > 0 && (
                    <Tooltip title="Бүх шалгуурыг арилгах" arrow>
                      <IconButton
                        size="small"
                        onClick={handleClearAllFilters}
                        sx={{ color: "#757575" }}
                      >
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            </Box>
            <Box sx={{ flexGrow: 1, minHeight: 0, overflowY: "auto", pr: 1 }}>
              <Stack spacing={3}>
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 600, mb: 1, color: "#424242" }}
                  >
                    Үндсэн мэдээлэл
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Цэгийн дугаар"
                      name="number"
                      value={formData.number}
                      onChange={handleChange}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon
                              fontSize="small"
                              sx={{ color: "#757575" }}
                            />
                          </InputAdornment>
                        ),
                      }}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label="Цэгийн нэр"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon
                              fontSize="small"
                              sx={{ color: "#757575" }}
                            />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Stack>
                </Box>
                <Box>
                  <Box>
                    <Button
                      fullWidth
                      variant="text"
                      onClick={() =>
                        setShowAdvancedFilters(!showAdvancedFilters)
                      }
                      startIcon={
                        showAdvancedFilters ? (
                          <ExpandLessIcon />
                        ) : (
                          <ExpandMoreIcon />
                        )
                      }
                      sx={{
                        justifyContent: "flex-start",
                        color: "#757575",
                        "&:hover": { backgroundColor: "#f5f5f5" },
                      }}
                    >
                      Ангилал
                    </Button>
                  </Box>
                </Box>
                <Collapse in={showAdvancedFilters}>
                  <Stack spacing={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Сүлжээний ангилал</InputLabel>
                      <Select
                        name="network"
                        value={formData.network}
                        onChange={handleChange}
                        label="Сүлжээний ангилал"
                      >
                        <MenuItem value="">
                          <em>Бүгд</em>
                        </MenuItem>
                        {networkParents.map((option) => (
                          <MenuItem key={option.id} value={String(option.id)}>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              {option.name}
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl
                      fullWidth
                      size="small"
                      disabled={!formData.network}
                    >
                      <InputLabel>Дэд сүлжээ</InputLabel>
                      <Select
                        name="class_in"
                        value={formData.class_in}
                        onChange={handleChange}
                        label="Дэд сүлжээ"
                      >
                        <MenuItem value="">
                          <em>Бүгд</em>
                        </MenuItem>
                        {networkChildOptions.map((option) => (
                          <MenuItem key={option.id} value={String(option.id)}>
                            {option.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                      <InputLabel>Төлөв</InputLabel>
                      <Select
                        name="status_id"
                        value={formData.status_id}
                        onChange={handleChange}
                        label="Төлөв"
                      >
                        <MenuItem value="">
                          <em>Бүгд</em>
                        </MenuItem>
                        {statusTypes?.map((option) => (
                          <MenuItem key={option.id} value={option.id}>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  backgroundColor: option.color || "#1976d2",
                                }}
                              />
                              {option.name}
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl fullWidth size="small">
                      <InputLabel>Төвийн төрөл</InputLabel>
                      <Select
                        name="center_type"
                        value={formData.center_type}
                        onChange={handleChange}
                        label="Төвийн төрөл"
                      >
                        <MenuItem value="">
                          <em>Бүгд</em>
                        </MenuItem>
                        {centerTypes?.map((option) => (
                          <MenuItem key={option.id} value={option.id}>
                            {option.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Stack>
                </Collapse>

                <Box sx={{ pt: 2 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={handleSearch}
                    startIcon={
                      loading ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <SearchIcon />
                      )
                    }
                    disabled={loading || getActiveFilterCount() === 0}
                    sx={{ py: 1.5 }}
                  >
                    {loading ? "Хайж байна..." : "Хайх"}
                  </Button>
                </Box>
              </Stack>
            </Box>
          </Box>

          <Box
            sx={{
              flex: 1,
              backgroundColor: "#fafafa",
              p: 3,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            {hasSearched ? (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  flexGrow: 1,
                  minHeight: 0,
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Хайлтын үр дүн
                    </Typography>
                    {/* <Typography variant="body2" color="text.secondary">
                      {!loading && totalCount > 0 ? (
                        <>
                          {totalCount} цэг олдлоо
                          {searchResults.filter(p => p.geoloc).length > 0 && (
                            <span style={{ marginLeft: 8 }}>
                              • {searchResults.filter(p => p.geoloc).length} газрын зурагтай
                            </span>
                          )}
                          {selectedPoint && (
                            <span style={{ marginLeft: 8, color: '#1976d2', fontWeight: 500 }}>
                              • 1 сонгогдсон
                            </span>
                          )}
                        </>
                      ) : 'Цэг олдсонгүй'}
                    </Typography> */}
                  </Box>
                  {selectedPoint && (
                    <Chip
                      label={`Сонгосон: ${selectedPoint.number}`}
                      color="primary"
                      variant="outlined"
                      onDelete={() => setSelectedPoint(null)}
                    />
                  )}
                </Box>

                {loading ? (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      flexGrow: 1,
                    }}
                  >
                    <CircularProgress />
                  </Box>
                ) : searchResults.length > 0 ? (
                  <Box
                    sx={{
                      flexGrow: 1,
                      minHeight: 0,
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                    }}
                  >
                    {/* Tabs for Table/Map View */}
                    <Box
                      sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}
                    >
                      <Tabs
                        value={activeTab}
                        onChange={(event, newValue) => setActiveTab(newValue)}
                        sx={{
                          "& .MuiTab-root": {
                            textTransform: "none",
                            fontWeight: 600,
                            fontSize: "0.9rem",
                          },
                        }}
                      >
                        <Tab
                          icon={<TableChartIcon />}
                          label="Хүснэгт"
                          iconPosition="start"
                          sx={{ minHeight: 48 }}
                        />
                        <Tab
                          icon={<MapIcon />}
                          label={`Газрын зураг (${searchResults.filter((p) => p.geoloc).length})`}
                          iconPosition="start"
                          sx={{ minHeight: 48 }}
                          disabled={
                            searchResults.filter((p) => p.geoloc).length === 0
                          }
                        />
                      </Tabs>
                    </Box>

                    {/* Tab Content */}
                    {activeTab === 0 ? (
                      <Box
                        sx={{
                          flexGrow: 1,
                          minHeight: 0,
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        <TableContainer
                          component={Paper}
                          sx={{
                            borderRadius: 2,
                            border: "1px solid #e0e0e0",
                            backgroundColor: "white",
                            flexGrow: 1,
                            minHeight: 0,
                            overflow: "auto",
                            "&::-webkit-scrollbar": {
                              width: "6px",
                            },
                            "&::-webkit-scrollbar-track": {
                              backgroundColor: "#f5f5f5",
                              borderRadius: "3px",
                            },
                            "&::-webkit-scrollbar-thumb": {
                              backgroundColor: "#bdbdbd",
                              borderRadius: "3px",
                              "&:hover": {
                                backgroundColor: "#9e9e9e",
                              },
                            },
                          }}
                        >
                          <Table stickyHeader size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell
                                  sx={{
                                    backgroundColor: "#f8f9fa",
                                    fontWeight: 600,
                                    color: "#424242",
                                    borderBottom: "2px solid #e0e0e0",
                                    py: 2,
                                  }}
                                >
                                  №
                                </TableCell>
                                <TableCell
                                  sx={{
                                    backgroundColor: "#f8f9fa",
                                    fontWeight: 600,
                                    color: "#424242",
                                    borderBottom: "2px solid #e0e0e0",
                                    py: 2,
                                  }}
                                >
                                  Цэгийн дугаар
                                </TableCell>
                                <TableCell
                                  sx={{
                                    backgroundColor: "#f8f9fa",
                                    fontWeight: 600,
                                    color: "#424242",
                                    borderBottom: "2px solid #e0e0e0",
                                    py: 2,
                                  }}
                                >
                                  Цэгийн нэр
                                </TableCell>
                                <TableCell
                                  sx={{
                                    backgroundColor: "#f8f9fa",
                                    fontWeight: 600,
                                    color: "#424242",
                                    borderBottom: "2px solid #e0e0e0",
                                    py: 2,
                                  }}
                                >
                                  Сүлжээ
                                </TableCell>
                                <TableCell
                                  sx={{
                                    backgroundColor: "#f8f9fa",
                                    fontWeight: 600,
                                    color: "#424242",
                                    borderBottom: "2px solid #e0e0e0",
                                    py: 2,
                                  }}
                                >
                                  Төлөв
                                </TableCell>
                                <TableCell
                                  sx={{
                                    backgroundColor: "#f8f9fa",
                                    fontWeight: 600,
                                    color: "#424242",
                                    borderBottom: "2px solid #e0e0e0",
                                    py: 2,
                                    textAlign: "center",
                                    width: 60,
                                  }}
                                >
                                  Сонгох
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {searchResults.map((point, index) => {
                                return (
                                  <TableRow
                                    key={point.id}
                                    hover
                                    selected={selectedPoint?.id === point.id}
                                    sx={{
                                      cursor: "pointer",
                                      backgroundColor:
                                        selectedPoint?.id === point.id
                                          ? "#e3f2fd"
                                          : "transparent",
                                      "&:hover": {
                                        backgroundColor:
                                          selectedPoint?.id === point.id
                                            ? "#bbdefb"
                                            : "#f5f5f5",
                                      },
                                      "&:nth-of-type(even)": {
                                        backgroundColor:
                                          selectedPoint?.id === point.id
                                            ? "#e3f2fd"
                                            : "#fafafa",
                                      },
                                      borderLeft:
                                        selectedPoint?.id === point.id
                                          ? "3px solid #1976d2"
                                          : "3px solid transparent",
                                    }}
                                    onClick={() => handlePointSelection(point)}
                                    onDoubleClick={() =>
                                      handleQuickSelection(point)
                                    }
                                  >
                                    <TableCell
                                      sx={{
                                        color: "#757575",
                                        fontWeight: 500,
                                        py: 1.5,
                                      }}
                                    >
                                      {page * rowsPerPage + index + 1}
                                    </TableCell>
                                    <TableCell
                                      sx={{
                                        fontWeight: 600,
                                        color: "#1976d2",
                                        py: 1.5,
                                      }}
                                    >
                                      {point?.number}
                                    </TableCell>
                                    <TableCell sx={{ py: 1.5 }}>
                                      {point?.name || "Нэргүй"}
                                    </TableCell>
                                    <TableCell sx={{ py: 1.5 }}>
                                      <Chip
                                        size="small"
                                        label={
                                          point?.network_type || "Тодорхойгүй"
                                        }
                                        variant="outlined"
                                        sx={{
                                          borderColor: "#1976d2",
                                          color: "#1976d2",
                                          fontSize: "0.75rem",
                                          height: 24,
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell sx={{ py: 1.5 }}>
                                      <Chip
                                        size="small"
                                        label={
                                          point.status?.name || "Тодорхойгүй"
                                        }
                                        sx={{
                                          backgroundColor: point.status?.color
                                            ? `${point.status?.color}20`
                                            : "#e8f5e8",
                                          color:
                                            point.status?.color || "#4caf50",
                                          fontSize: "0.75rem",
                                          height: 24,
                                          border: "none",
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell
                                      sx={{ textAlign: "center", py: 1.5 }}
                                    >
                                      <Checkbox
                                        checked={selectedPoint?.id === point.id}
                                        onChange={() =>
                                          handlePointSelection(point)
                                        }
                                        color="primary"
                                        size="small"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          flexGrow: 1,
                          minHeight: 0,
                          backgroundColor: "white",
                          borderRadius: 2,
                          border: "1px solid #e0e0e0",
                          overflow: "hidden",
                        }}
                      >
                        <PointsMap
                          points={searchResults}
                          selectedPointId={selectedPoint?.id}
                          onPointClick={handlePointSelection}
                        />
                      </Box>
                    )}

                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "flex-end",
                        mt: 2,
                        backgroundColor: "white",
                        borderRadius: 2,
                        border: "1px solid #e0e0e0",
                        px: 1,
                      }}
                    >
                      <TablePagination
                        component="div"
                        count={totalCount}
                        page={page}
                        onPageChange={handleChangePage}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        rowsPerPageOptions={[5, 10, 25, 50]}
                        labelRowsPerPage="Нэг хуудсанд"
                      />
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ textAlign: "center", py: 8 }}>
                    <Typography color="text.secondary" variant="h6">
                      Хайлтад тохирох цэг олдсонгүй
                    </Typography>
                    <Typography
                      color="text.secondary"
                      variant="body2"
                      sx={{ mt: 1 }}
                    >
                      Өөр шалгуур ашиглан дахин хайж үзнэ үү
                    </Typography>
                  </Box>
                )}
              </Box>
            ) : (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  textAlign: "center",
                }}
              >
                <SearchIcon sx={{ fontSize: 64, color: "#e0e0e0", mb: 2 }} />
                <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                  Хайлт эхлүүлэх
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Зүүн талаас хайлтын шалгуурыг оруулаад Хайх товчийг дарна уу
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 3,
          borderTop: "1px solid #e0e0e0",
          backgroundColor: "white",
        }}
      >
        <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center" }}></Box>

        <Button variant="outlined" onClick={handleReset} sx={{ mr: 1 }}>
          Цэвэрлэх
        </Button>

        <Button variant="outlined" onClick={onClose} sx={{ mr: 1 }}>
          Болих
        </Button>

        {selectedPoint && (
          <Button
            variant="contained"
            onClick={handleConfirmSelection}
            color="primary"
          >
            Сонгох
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default MeasurementFindPoint;
