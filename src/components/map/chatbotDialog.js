import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Paper,
  Avatar,
  Fab,
  Fade,
  CircularProgress,
  Popover,
  Card,
  Chip,
  Stack,
  Button,
  Alert,
} from "@mui/material";
import {
  Close as CloseIcon,
  Send as SendIcon,
  Chat as ChatIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  LocationOn as LocationIcon,
  AccountTree as NetworkIcon,
  MyLocation as ShowOnMapIcon,
} from "@mui/icons-material";
import axiosInstance, { endpoints } from "src/utils/axios";

const ChatbotDialog = ({ onShowOnMap, onShowMultiplePoints, onRemoveCqlLayer, onShowFilteredPoints }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Сайн байна уу! Би танд геодезийн цэгүүдийг хайхад туслах боломжтой. Цэгийн нэр, сүлжээний төрөл, ойролцоо солбицол, засаг захиргаа, огноогоор мэдээллээ оруулна уу..",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [inputError, setInputError] = useState("");
  const [hasSuccessfulPointData, setHasSuccessfulPointData] = useState(false);
  const messagesEndRef = useRef(null);
  const anchorRef = useRef(null);

  const isValidMongolianCyrillic = (text) => {
    if (!text.trim()) return true;
    const withoutGnss = text.replace(/\bgnss\b/ig, "").trim();

    const mongolianCyrillicRegex = /^[0-9KLMNklmnIV\u0410-\u044F\u0401\u0451\u04E8\u04E9\u04AE\u04AF\u04BA\u04BB\s.,!?()-]*$/;

    return mongolianCyrillicRegex.test(withoutGnss);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [open]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    if (!isValidMongolianCyrillic(message)) {
      setInputError("Зөвхөн монгол кирилл үсэг болон 'gnss' үгийг ашиглана уу");
      return;
    }

    setInputError("");

    const userMessage = {
      id: Date.now(),
      text: message,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setMessage("");
    setLoading(true);

    const URL = endpoints.measurement.nl;

    try {
      const res = await axiosInstance.post(URL, { q: message });

      const results = res?.data?.results || res?.data;

      let points = [];
      let botText = `Одоогоор цэг бүртгэгдээгүй байна`;
      let messageStatus = "primary";

      if (Array.isArray(results) && results.length > 0 && results[0]?.status === "error") {
        botText = results[0]?.message || "Алдаа гарлаа";
        messageStatus = "error";
        points = [];
      } 
      else if (Array.isArray(results) && results.length > 0 && results[0]?.status !== "error") {
        points = results;
        botText = `Доорхи цэгүүд ирлээ`;
        messageStatus = "success";
      } 
      else if (
        results &&
        typeof results === "object" &&
        Object.prototype.hasOwnProperty.call(results, "value") &&
        Object.prototype.hasOwnProperty.call(results, "unit")
      ) {
        botText = `${results.value}${results.unit} цэг бүртгэлтэй байна`;
        messageStatus = "success";
      } 
      else if (Array.isArray(results) && results.length > 0) {
        botText = results[0]?.message || botText;
        messageStatus = results[0]?.status || "primary";
      }

      const botMessage = {
        id: Date.now() + 1,
        text: botText,
        sender: "bot",
        status: messageStatus,
        points: points,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);

      if (points.length > 0 && onShowMultiplePoints) {
        setHasSuccessfulPointData(true);
        onShowMultiplePoints(points, { 
          // fitToExtent: true,
          // style: 'highlight_style' 
        });
      }
    } catch (error) {
      const response = error.response;
      let botMessage;
      
      let errorData = null;
      if (Array.isArray(response?.data)) {
        errorData = response.data[0];
      } else if (response?.data?.results && Array.isArray(response.data.results)) {
        errorData = response.data.results[0];
      }

      if (response?.status === 404) {
        botMessage = {
          id: Date.now() + 1,
          text: errorData?.message || "404 - мессеж ирсэнгүй",
          sender: "bot",
          status: errorData?.status || "error",
          timestamp: new Date(),
        };
      } else if (response?.status >= 200 && response?.status < 300) {
        botMessage = {
          id: Date.now() + 1,
          text:
            errorData?.message || "Уучлаарай, одоогоор хариулах боломжгүй байна.",
          sender: "bot",
          status: errorData?.status || "success",
          timestamp: new Date(),
        };
      } else {
        botMessage = {
          id: Date.now() + 1,
          text: errorData?.message || "Уучлаарай, алдаа гарлаа. Дахин оролдоно уу.",
          sender: "bot",
          status: errorData?.status || "error",
          timestamp: new Date(),
        };
      }

      setMessages((prev) => [...prev, botMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleMessageChange = (e) => {
    const newValue = e.target.value;
    setMessage(newValue);
    
    if (newValue.trim() && !isValidMongolianCyrillic(newValue)) {
      setInputError("Зөвхөн монгол кирилл үсэг болон 'gnss' үгийг ашиглана уу");
    } else {
      setInputError("");
    }
  };

  const formatTime = (timestamp) => {
    return new Intl.DateTimeFormat("mn-MN", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(timestamp);
  };

  return (
    <>
      <Fade in={!open}>
        <Fab
          ref={anchorRef}
          color="primary"
          onClick={() => setOpen(true)}
          id='map-chatbot'
          sx={{
            position: "absolute",
            bottom: 24,
            right: 24,
            zIndex: 2,
            boxShadow: "0 4px 20px rgba(25, 118, 210, 0.3)",
            "&:hover": {
              transform: "scale(1.1)",
              transition: "transform 0.2s ease-in-out",
            },
          }}
        >
          <ChatIcon />
        </Fab>
      </Fade>

      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={() => setOpen(false)}
        anchorOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        PaperProps={{
          elevation: 8,
          sx: {
            padding: 0,
            width: 380,
            height: 500,
            borderRadius: 3,
            overflow: "hidden",
            border: "1px solid rgba(0, 0, 0, 0.1)",
          },
        }}
      >
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              bgcolor: "primary.main",
              color: "white",
              p: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <BotIcon sx={{ fontSize: 20 }} />
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600 }}
              >Чатбот</Typography>
            </Box>
            <IconButton
              onClick={() => setOpen(false)}
              sx={{ color: "white", p: 0.5 }}
              size="small"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box
            sx={{
              flex: 1,
              overflow: "auto",
              p: 1.5,
              bgcolor: "#f8f9fa",
              display: "flex",
              flexDirection: "column",
              gap: 1,
            }}
          >
            {messages.map((msg) => {
              return (
                <Box
                  key={msg.id}
                  sx={{
                    display: "flex",
                    justifyContent:
                      msg?.sender === "user" ? "flex-end" : "flex-start",
                    alignItems: "flex-start",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection:
                        msg?.sender === "user" ? "row-reverse" : "row",
                      alignItems: "flex-start",
                      gap: 0.8,
                      maxWidth: "85%",
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 28,
                        height: 28,
                        bgcolor:
                          msg?.sender === "user" ? "primary.main" : "grey.500",
                        flexShrink: 0,
                      }}
                    >
                      {msg?.sender === "user" ? (
                        <PersonIcon sx={{ fontSize: 16 }} />
                      ) : (
                        <BotIcon sx={{ fontSize: 16 }} />
                      )}
                    </Avatar>
                    <Paper
                      sx={{
                        p: 1.2,
                        bgcolor: msg?.sender === "user" 
                          ? "primary.main" 
                          : msg?.status === "error" 
                            ? "#ffebee" 
                            : "white",
                        color: msg?.sender === "user" 
                          ? "white" 
                          : msg?.status === "error"
                            ? "#d32f2f"
                            : "text.primary",
                        borderRadius: 2,
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                        border: msg?.status === "error" ? "1px solid #ffcdd2" : "none",
                        position: "relative",
                        "&::before": {
                          content: '""',
                          position: "absolute",
                          width: 0,
                          height: 0,
                          border: "6px solid transparent",
                          ...(msg?.sender === "user"
                            ? {
                                right: -6,
                                top: 8,
                                borderLeftColor: "primary.main",
                              }
                            : {
                                left: -6,
                                top: 8,
                                borderRightColor: msg?.status === "error" ? "#ffebee" : "white",
                              }),
                        },
                      }}
                    >
                      {msg?.points && msg?.points?.length > 0 ? (
                        <Stack spacing={1.5} sx={{ mt: 1 }}>
                          <Typography
                            variant="body2"
                            sx={{ fontSize: "0.85rem", mb: 1 }}
                          >
                            {msg?.text}
                          </Typography>
                          {msg.points.map((pointData, idx) => {
                            const point = pointData?.point;
                            const network = pointData?.network;
                            const description = pointData?.description;

                            const locationParts =
                              point?.unit?.map((u) => u.unit)?.reverse() || [];
                            const locationText = locationParts.join(", ");
                            return (
                              <Card
                                key={point?.id || idx}
                                elevation={1}
                                sx={{
                                  borderRadius: 1.5,
                                  border: "1px solid #e0e0e0",
                                  "&:hover": {
                                    boxShadow: 2,
                                    transition: "box-shadow 0.2s ease",
                                  },
                                }}
                              >
                                <Box sx={{ display: "flex", p: 1.5 }}>
                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Box
                                      sx={{
                                        display: "flex",
                                        alignItems: "flex-start",
                                        justifyContent: "space-between",
                                        mb: 0.5,
                                      }}
                                    >
                                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                        <Chip
                                          label={`#${idx + 1}`}
                                          size="small"
                                          color="primary"
                                          sx={{
                                            height: 20,
                                            fontSize: "0.7rem",
                                            pr: 0.3,
                                            pl: 0.3
                                            // ml: 1,
                                            // flexShrink: 0,
                                          }}
                                        />
                                        <Typography
                                          variant="subtitle2"
                                          sx={{
                                            fontWeight: 600,
                                            fontSize: "0.9rem",
                                            lineHeight: 1.2,
                                          }}
                                        >
                                          {point?.name}
                                        </Typography>
                                      </Box>
                                      {/* <Box></Box> */}
                                    </Box>

                                    {point?.number && (
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "text.secondary",
                                          fontSize: "0.75rem",
                                          display: "block",
                                          mb: 0.5,
                                        }}
                                      >
                                        Дугаар: {point.number}
                                      </Typography>
                                    )}

                                    {locationText && (
                                      <Box
                                        sx={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 0.5,
                                          mb: 0.5,
                                        }}
                                      >
                                        <LocationIcon
                                          sx={{
                                            fontSize: 12,
                                            color: "text.secondary",
                                          }}
                                        />
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            color: "text.secondary",
                                            fontSize: "0.75rem",
                                          }}
                                        >
                                          {locationText}
                                        </Typography>
                                      </Box>
                                    )}

                                    {network?.name && (
                                      <Box
                                        sx={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 0.5,
                                          mb: 0.8,
                                        }}
                                      >
                                        <NetworkIcon
                                          sx={{
                                            fontSize: 12,
                                            color: "text.secondary",
                                          }}
                                        />
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            color: "text.secondary",
                                            fontSize: "0.75rem",
                                          }}
                                        >
                                          {network.name}
                                        </Typography>
                                      </Box>
                                    )}

                                    {description && (
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          fontSize: "0.8rem",
                                          color: "text.primary",
                                          lineHeight: 1.3,
                                          bgcolor: "#f8f9fa",
                                          p: 1,
                                          borderRadius: 1,
                                          border: "1px solid #e9ecef",
                                          mb: 1,
                                        }}
                                      >
                                        {description}
                                      </Typography>
                                    )}

                                    {point?.geoloc?.coordinates &&
                                      onShowOnMap && (
                                        <Button
                                          variant="outlined"
                                          size="small"
                                          startIcon={
                                            <ShowOnMapIcon
                                              sx={{ fontSize: 14 }}
                                            />
                                          }
                                          onClick={() => {
                                            const coords =
                                              point.geoloc.coordinates;
                                            if (coords && coords.length >= 2) {
                                              onShowOnMap({
                                                coordinates: coords,
                                                point: point,
                                                pointData: pointData,
                                              });
                                              setOpen(false); // Close chatbot
                                            }
                                          }}
                                          sx={{
                                            fontSize: "0.7rem",
                                            height: 28,
                                            borderColor: "primary.main",
                                            color: "primary.main",
                                            "&:hover": {
                                              bgcolor: "primary.main",
                                              color: "white",
                                            },
                                          }}
                                        >
                                          Газрын зураг дээр харах
                                        </Button>
                                      )}
                                  </Box>
                                </Box>
                              </Card>
                            );
                          })}
                        </Stack>
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{ fontSize: "0.85rem" }}
                        >
                          {msg?.text}
                        </Typography>
                      )}
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          mt: 0.3,
                          opacity: 0.7,
                          fontSize: "0.65rem",
                        }}
                      >
                        {formatTime(msg?.timestamp)}
                      </Typography>
                    </Paper>
                  </Box>
                </Box>
              );
            })}
            {loading && (
              <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
                <Box
                  sx={{ display: "flex", alignItems: "flex-start", gap: 0.8 }}
                >
                  <Avatar sx={{ width: 28, height: 28, bgcolor: "grey.500" }}>
                    <BotIcon sx={{ fontSize: 16 }} />
                  </Avatar>
                  <Paper
                    sx={{
                      p: 1.2,
                      borderRadius: 2,
                      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                      bgcolor: "white",
                    }}
                  >
                    <CircularProgress size={16} />
                  </Paper>
                </Box>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          <Box
            sx={{
              p: 1.5,
              borderTop: "1px solid #e0e0e0",
              bgcolor: "white",
            }}
          >
            {onRemoveCqlLayer && hasSuccessfulPointData && (
              <Box sx={{ mb: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  fullWidth
                  onClick={() => {
                    onRemoveCqlLayer();
                    setHasSuccessfulPointData(false);
                  }}
                  sx={{
                    fontSize: '0.7rem',
                    height: 32,
                    borderColor: 'error.main',
                    color: 'error.main',
                    '&:hover': { 
                      borderColor: 'error.dark',
                      color: 'error.dark',
                      bgcolor: 'error.light'
                    }
                  }}
                >
                  Цэгүүдийг арилгах
                </Button>
              </Box>
            )}
            
            {inputError && (
              <Alert severity="error" sx={{ mb: 1, fontSize: "0.75rem" }}>
                {inputError}
              </Alert>
            )}
            
            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
              <TextField
                fullWidth
                multiline
                maxRows={2}
                value={message}
                onChange={handleMessageChange}
                onKeyPress={handleKeyPress}
                placeholder="Асуулт (зөвхөн кирилл үсэг)"
                variant="outlined"
                size="small"
                disabled={loading}
                error={!!inputError}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    fontSize: "0.85rem",
                  },
                  "& .MuiInputBase-input": {
                    py: 1,
                  },
                }}
              />
              <IconButton
                onClick={handleSendMessage}
                disabled={!message.trim() || loading || !!inputError}
                sx={{
                  bgcolor: "primary.main",
                  color: "white",
                  width: 36,
                  height: 36,
                  "&:hover": {
                    bgcolor: "primary.dark",
                  },
                  "&.Mui-disabled": {
                    bgcolor: "grey.300",
                    color: "grey.500",
                  },
                }}
              >
                <SendIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Popover>
    </>
  );
};

export default ChatbotDialog;
