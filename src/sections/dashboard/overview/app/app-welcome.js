import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha, useTheme } from "@mui/material/styles";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";

import { bgGradient } from "src/theme/css";
import { Button, ButtonBase, MenuItem } from "@mui/material";
import Iconify from "src/components/iconify";
import CustomPopover, { usePopover } from "src/components/custom-popover";

// ----------------------------------------------------------------------

export default function AppWelcome({
  title,
  description,
  selectedYear,
  onYearChange,
  ...other
}) {
  const theme = useTheme();
  const pop = usePopover();
  const years = [
    "Бүгд",
    ...Array.from({ length: 6 }, (_, i) =>
      String(new Date().getFullYear() - i),
    ),
  ];

  const handleSelect = (val) => {
    if (onYearChange) onYearChange(val === "Бүгд" ? "Бүгд" : Number(val));
    pop.onClose();
  };

  return (
    <Stack
      flexDirection={{ xs: "column", md: "row" }}
      sx={{
        ...bgGradient({
          direction: "135deg",
          startColor: alpha(theme.palette.primary.light, 0.2),
          endColor: alpha(theme.palette.primary.main, 0.2),
        }),
        borderRadius: 2,
        position: "relative",
        color: "primary.darker",
        backgroundColor: "common.white",
        padding: { xs: 3, md: 5 },
      }}
      {...other}
    >
      <Stack
        justifyContent="center"
        alignItems={{ xs: "center", md: "flex-start" }}
        sx={{
          maxWidth: { xs: "100%", md: "100%" },
        }}
      >
        <Typography variant="h4" sx={{ mb: 2, whiteSpace: "pre-line" }}>
          {title}
        </Typography>
        {/* eslint-disable react/no-unescaped-entities */}
        <Typography
          variant="body2"
          sx={{
            opacity: 0.8,
            textAlign: "justify", // 🚩 Илүү гоё уншигдах байдлаар
          }}
        >
          11 дүгээр зүйл.Газар зүйн нэр
          <br />
          11.1.Байгууллага, аж ахуйн нэгж, иргэдийг газар зүйн албан ёсны нэрийн
          тухай мэдээллээр хангах, газар зүйн нэрийг зөв бичих, хэрэглэх,
          хамгаалах асуудлыг сум, дүүргийн Засаг дарга, геодези, зураг зүйн
          асуудал эрхэлсэн төрийн захиргааны байгууллага эрхлэн хамтран
          зохицуулна.
          <br />
          <br />
          11.3.Газар зүйн нэрэнд дараахь обьектын нэр хамаарна:
          <br />
          11.3.1.эх газар, далай, тэнгис, булан, тохой, арал, хойг, уул, нуруу,
          хээр, тал, говь, цөл, мөрөн, гол, нуур зэрэг физик газар зүйн объект;
          <br />
          11.3.2.хүний үйл ажиллагаагаар бий болсон далан, усан сан, суваг,
          шуудуу;
          <br />
          11.3.3.улс, засаг захиргаа, нутаг дэвсгэрийн нэгж, тэдгээрийн доторх
          хөдөө аж ахуй, үйлдвэр, тээвэр, холбоо зэрэг бусад объект.
          <br />
        </Typography>
        {/* eslint-enable react/no-unescaped-entities */}

        <Stack
          direction="row"
          justifyContent={{ xs: "center", md: "flex-between" }}
          sx={{ mt: { xs: 1, md: 3 }, width: "100%" }}
        >
          <ButtonBase
            ref={pop.anchorRef}
            onClick={pop.onOpen}
            variant="contained"
            sx={(theme) => ({
              px: 4,
              py: 1.5,
              mr: 2,
              borderRadius: 2,
              fontWeight: 600,
              textTransform: "none",
              color: theme.palette.common.white,
              boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.24)}`,
              backgroundImage: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              "&:hover": {
                backgroundImage: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.darker})`,
                boxShadow: `0 24px 48px ${alpha(theme.palette.primary.main, 0.32)}`,
              },
            })}
            id="stat-year"
          >
            {selectedYear === "Бүгд" ? "Бүгд" : `${selectedYear} он`}
            <Iconify
              width={16}
              icon={
                pop.open
                  ? "eva:arrow-ios-upward-fill"
                  : "eva:arrow-ios-downward-fill"
              }
              sx={{ ml: 0.5 }}
            />
          </ButtonBase>

          <Button
            href={process.env.NEXT_PUBLIC_PORTAL_URL ?? "https://geodesy.gov.mn"}
            variant="contained"
            endIcon={<ArrowForwardRoundedIcon fontSize="medium" />}
            sx={(theme) => ({
              px: 4,
              py: 1.5,
              borderRadius: 2,
              fontWeight: 600,
              textTransform: "none",
              color: theme.palette.common.white,
              boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.24)}`,
              backgroundImage: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              "&:hover": {
                backgroundImage: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.darker})`,
                boxShadow: `0 24px 48px ${alpha(theme.palette.primary.main, 0.32)}`,
              },
            })}
          >
            Портал руу шилжих
          </Button>

          <CustomPopover
            open={pop.open}
            onClose={pop.onClose}
            sx={{ width: 140 }}
          >
            {years.map((year) => (
              <MenuItem
                key={year}
                selected={year === selectedYear}
                onClick={() => handleSelect(year)}
                sx={{ color: "black" }}
              >
                {year}
              </MenuItem>
            ))}
          </CustomPopover>
        </Stack>
      </Stack>
    </Stack>
  );
}
