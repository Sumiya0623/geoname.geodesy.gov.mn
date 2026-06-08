import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import { useState } from "react";
import { Button } from "@mui/material";

export default function SlotsDialog({ open, onClose, onSave, initial }) {
  const [text, setText] = useState(
    initial ? JSON.stringify(initial, null, 2) : "{}",
  );
  const [err, setErr] = useState("");

  const handleSave = () => {
    try {
      const json = text.trim() ? JSON.parse(text) : {};
      onSave(json);
    } catch (e) {
      setErr("JSON буруу байна");
      return;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>gold_slots (JSON)</DialogTitle>
      <DialogContent>
        <TextField
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (err) setErr("");
          }}
          multiline
          minRows={8}
          fullWidth
          error={!!err}
          helperText={
            err || 'Жишээ: {"year":2024, "admin_names":["Улаанбаатар"]}'
          }
          InputProps={{
            style: { fontFamily: "ui-monospace, Menlo, Consolas" },
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Буцах</Button>
        <Button variant="contained" color="primary" onClick={handleSave}>
          Хадгалах
        </Button>
      </DialogActions>
    </Dialog>
  );
}
