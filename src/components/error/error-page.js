'use client';

import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

// ----------------------------------------------------------------------
// Геодези, зураг зүйн удирдлагын нэгдсэн системийн НИЙТЛЭГ алдааны хуудас.
// main, point, geoname, monpos, border, device (lab), archive (eservice), map —
// БҮГДЭД ЭНЭ ФАЙЛ ЯГ ИЖИЛ. Системийн theme/header‑ээс хамаарахгүй (өөрийн
// өнгө, фонт, лого), тиймээс хаана ч ижил харагдана. Өөрчлөх бол бүгдэд нь
// ижилхэн хуулна.
// ----------------------------------------------------------------------

const LOGO = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzNzMiIGhlaWdodD0iMzczIiB2aWV3Qm94PSItNSAtNSAzODMgMzgzIj4KICA8ZGVmcz4KICAgIDxyYWRpYWxHcmFkaWVudCBpZD0ic3BoZXJlIiBjeD0iMC4zNiIgY3k9IjAuMzAiIHI9IjAuODUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiM2RkI0RkYiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIwLjQ1IiBzdG9wLWNvbG9yPSIjMTM3OUZCIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMC44NSIgc3RvcC1jb2xvcj0iIzAwNDhENiIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwMDMwQTgiLz4KICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImdSaW5nIiB4MT0iMC4yIiB5MT0iMCIgeDI9IjAuOCIgeTI9IjEiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiM3REI4RkYiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwMDNGQzAiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9InNwZWMiIGN4PSIwLjM0IiBjeT0iMC4yNiIgcj0iMC41Ij4KICAgICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZmZmZmZmIiBzdG9wLW9wYWNpdHk9IjAuNSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjAuNSIgc3RvcC1jb2xvcj0iI2ZmZmZmZiIgc3RvcC1vcGFjaXR5PSIwLjA4Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2ZmZmZmZiIgc3RvcC1vcGFjaXR5PSIwIi8+CiAgICA8L3JhZGlhbEdyYWRpZW50PgogICAgPHJhZGlhbEdyYWRpZW50IGlkPSJ2aWduZXR0ZSIgY3g9IjAuNSIgY3k9IjAuNSIgcj0iMC41Ij4KICAgICAgPHN0b3Agb2Zmc2V0PSIwLjcyIiBzdG9wLWNvbG9yPSIjMDAxYTVhIiBzdG9wLW9wYWNpdHk9IjAiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMDAxYTVhIiBzdG9wLW9wYWNpdHk9IjAuNDUiLz4KICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgICA8Y2xpcFBhdGggaWQ9ImRpc2MiPjxjaXJjbGUgY3g9IjE4Ni41IiBjeT0iMTg2LjUiIHI9IjE3MCIvPjwvY2xpcFBhdGg+CiAgICA8ZmlsdGVyIGlkPSJzb2Z0IiB4PSItNDAlIiB5PSItNDAlIiB3aWR0aD0iMTgwJSIgaGVpZ2h0PSIxODAlIj48ZmVHYXVzc2lhbkJsdXIgc3RkRGV2aWF0aW9uPSI3Ii8+PC9maWx0ZXI+CiAgICA8ZmlsdGVyIGlkPSJtYXBCbHVyIiB4PSItMzAlIiB5PSItMzAlIiB3aWR0aD0iMTYwJSIgaGVpZ2h0PSIxNjAlIj48ZmVHYXVzc2lhbkJsdXIgc3RkRGV2aWF0aW9uPSIyLjIiLz48L2ZpbHRlcj4KICA8L2RlZnM+CgogIDxjaXJjbGUgY3g9IjE4Ni41IiBjeT0iMTkwIiByPSIxNzYiIGZpbGw9IiMwODMwN0YiIG9wYWNpdHk9IjAuMzQiIGZpbHRlcj0idXJsKCNzb2Z0KSIvPgogIDxjaXJjbGUgY3g9IjE4Ni41IiBjeT0iMTg2LjUiIHI9IjE4MiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ1cmwoI2dSaW5nKSIgc3Ryb2tlLXdpZHRoPSI5Ii8+CiAgPGNpcmNsZSBjeD0iMTg2LjUiIGN5PSIxODYuNSIgcj0iMTcwIiBmaWxsPSJ1cmwoI3NwaGVyZSkiLz4KCiAgPGcgY2xpcC1wYXRoPSJ1cmwoI2Rpc2MpIj4KICAgIDxnIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLW9wYWNpdHk9IjAuMjAiIHN0cm9rZS13aWR0aD0iMS40Ij4KICAgICAgPGVsbGlwc2UgY3g9IjE4Ni41IiBjeT0iMTg2LjUiIHJ4PSI1NS4xIiByeT0iMTYyIi8+CiAgICAgIDxlbGxpcHNlIGN4PSIxODYuNSIgY3k9IjE4Ni41IiByeD0iMTYyIiByeT0iNTUuMSIvPgogICAgICA8ZWxsaXBzZSBjeD0iMTg2LjUiIGN5PSIxODYuNSIgcng9IjEwNi45IiByeT0iMTYyIi8+CiAgICAgIDxlbGxpcHNlIGN4PSIxODYuNSIgY3k9IjE4Ni41IiByeD0iMTYyIiByeT0iMTA2LjkiLz4KICAgICAgPGxpbmUgeDE9IjE4Ni41IiB5MT0iMjQuNSIgeDI9IjE4Ni41IiB5Mj0iMzQ4LjUiLz4KICAgICAgPGxpbmUgeDE9IjI0LjUiIHkxPSIxODYuNSIgeDI9IjM0OC41IiB5Mj0iMTg2LjUiLz4KICAgIDwvZz4KICAgIDxwYXRoIGQ9Ik0gMTM1IDEwOSBRIDE0NyAxMTUgMTQ4LjUgMTE0LjUgUSAxNTAgMTE0IDE1My41IDExNi4wIFEgMTU3IDExOCAxNjIuMCAxMTkuMCBRIDE2NyAxMjAgMTY4LjAgMTI2LjAgUSAxNjkgMTMyIDE3My4wIDEzNS4wIFEgMTc3IDEzOCAxODMuMCAxMzkuNSBRIDE4OSAxNDEgMTkwLjUgMTM5LjUgUSAxOTIgMTM4IDE5Ny4wIDEzNi41IFEgMjAyIDEzNSAyMDYuNSAxMzYuNSBRIDIxMSAxMzggMjEzLjAgMTM3LjUgUSAyMTUgMTM3IDIxOC41IDE0MC4wIFEgMjIyIDE0MyAyMjUuMCAxNDMuMCBRIDIyOCAxNDMgMjI4LjUgMTQ1LjAgUSAyMjkgMTQ3IDIzMi41IDE1MC4wIFEgMjM2IDE1MyAyNDAuMCAxNTMuMCBRIDI0NCAxNTMgMjQ4LjAgMTU0LjUgUSAyNTIgMTU2IDI1Ni41IDE1Ni4wIFEgMjYxIDE1NiAyNjUuMCAxNTQuMCBRIDI2OSAxNTIgMjc0LjUgMTUxLjUgUSAyODAgMTUxIDI4Ny41IDE0NS4wIFEgMjk1IDEzOSAyOTguNSAxMzkuMCBRIDMwMiAxMzkgMzA1LjAgMTQxLjUgUSAzMDggMTQ0IDMxMy41IDE0My41IFEgMzE5IDE0MyAzMjAuMCAxNDQuNSBRIDMyMSAxNDYgMzE1LjAgMTYwLjAgUSAzMDkgMTc0IDMxMS4wIDE3Ni4wIFEgMzEzIDE3OCAzMTkuMCAxNzcuMCBRIDMyNSAxNzYgMzI2LjUgMTc3LjUgUSAzMjggMTc5IDMzMS4wIDE3Ni41IFEgMzM0IDE3NCAzMzcuNSAxNzQuMCBRIDM0MSAxNzQgMzQ3LjAgMTgwLjAgUSAzNTMgMTg2IDM1My41IDE4OS41IFEgMzU0IDE5MyAzNDYuNSAxOTIuMCBRIDMzOSAxOTEgMzM0LjUgMTkyLjUgUSAzMzAgMTk0IDMyOS4wIDE5NS41IFEgMzI4IDE5NyAzMjUuMCAxOTcuMCBRIDMyMiAxOTcgMzE5LjUgMTk5LjUgUSAzMTcgMjAyIDMxNi41IDIwNC41IFEgMzE2IDIwNyAzMTMuMCAyMDkuMCBRIDMxMCAyMTEgMzA1LjAgMjExLjAgUSAzMDAgMjExIDI5NS41IDIxNS41IFEgMjkxIDIyMCAyODcuNSAyMjAuMCBRIDI4NCAyMjAgMjgwLjUgMjE4LjAgUSAyNzcgMjE2IDI3NC41IDIxNi4wIFEgMjcyIDIxNiAyNjguNSAyMjEuMCBRIDI2NSAyMjYgMjY4LjAgMjMxLjAgUSAyNzEgMjM2IDI2Ny4wIDIzOC4wIFEgMjYzIDI0MCAyNTkuMCAyNDQuNSBRIDI1NSAyNDkgMjQ5LjUgMjUxLjUgUSAyNDQgMjU0IDIzNy41IDI1My41IFEgMjMxIDI1MyAyMjUuMCAyNTQuMCBRIDIxOSAyNTUgMjA5LjAgMjYwLjAgUSAxOTkgMjY1IDE5Ny41IDI2NS4wIFEgMTk2IDI2NSAxOTQuNSAyNjMuMCBRIDE5MyAyNjEgMTg5LjUgMjYyLjAgUSAxODYgMjYzIDE4Mi41IDI2MS4wIFEgMTc5IDI1OSAxNzMuNSAyNTguMCBRIDE2OCAyNTcgMTY1LjUgMjU0LjUgUSAxNjMgMjUyIDE1NS41IDI1MS4wIFEgMTQ4IDI1MCAxNDAuNSAyNTAuNSBRIDEzMyAyNTEgMTI1LjAgMjQ5LjUgUSAxMTcgMjQ4IDExMy4wIDI0OC41IFEgMTA5IDI0OSAxMDYuNSAyNDYuNSBRIDEwNCAyNDQgMTAwLjUgMjM2LjAgUSA5NyAyMjggOTQuMCAyMjcuNSBRIDkxIDIyNyA4NS4wIDIyMi41IFEgNzkgMjE4IDY4LjAgMjE3LjAgUSA1NyAyMTYgNTMuMCAyMTQuMCBRIDQ5IDIxMiA0OS4wIDIwOS41IFEgNDkgMjA3IDUwLjUgMjA1LjAgUSA1MiAyMDMgNTEuNSAxOTYuMCBRIDUxIDE4OSA0NS41IDE4MS41IFEgNDAgMTc0IDM0LjUgMTcyLjUgUSAyOSAxNzEgMjUuMCAxNjcuNSBRIDIxIDE2NCAyMS4wIDE2MS4wIFEgMjEgMTU4IDIyLjAgMTU0LjUgUSAyMyAxNTEgMjcuMCAxNTEuMCBRIDMxIDE1MSAzNi41IDE0Ni4wIFEgNDIgMTQxIDUzLjUgMTM1LjUgUSA2NSAxMzAgNjguMCAxMzAuMCBRIDcxIDEzMCA3Mi4wIDEzMS41IFEgNzMgMTMzIDc4LjAgMTMzLjAgUSA4MyAxMzMgODYuMCAxMzcuNSBRIDg5IDE0MiA5Mi41IDE0My4wIFEgOTYgMTQ0IDEwNC41IDE0NC4wIFEgMTEzIDE0NCAxMTUuNSAxNDUuNSBRIDExOCAxNDcgMTIxLjUgMTQ1LjAgUSAxMjUgMTQzIDEyNy4wIDE0MC4wIFEgMTI5IDEzNyAxMjYuNSAxMzEuMCBRIDEyNCAxMjUgMTI1LjAgMTIyLjAgUSAxMjYgMTE5IDEzMC4wIDExNC41IFEgMTM0IDExMCAxMzQuNSAxMDkuNSBaIiBmaWxsPSIjMDEyYTdhIiBvcGFjaXR5PSIwLjMyIiBmaWx0ZXI9InVybCgjbWFwQmx1cikiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDAsMykiLz4KICAgIDxwYXRoIGQ9Ik0gMTM1IDEwOSBRIDE0NyAxMTUgMTQ4LjUgMTE0LjUgUSAxNTAgMTE0IDE1My41IDExNi4wIFEgMTU3IDExOCAxNjIuMCAxMTkuMCBRIDE2NyAxMjAgMTY4LjAgMTI2LjAgUSAxNjkgMTMyIDE3My4wIDEzNS4wIFEgMTc3IDEzOCAxODMuMCAxMzkuNSBRIDE4OSAxNDEgMTkwLjUgMTM5LjUgUSAxOTIgMTM4IDE5Ny4wIDEzNi41IFEgMjAyIDEzNSAyMDYuNSAxMzYuNSBRIDIxMSAxMzggMjEzLjAgMTM3LjUgUSAyMTUgMTM3IDIxOC41IDE0MC4wIFEgMjIyIDE0MyAyMjUuMCAxNDMuMCBRIDIyOCAxNDMgMjI4LjUgMTQ1LjAgUSAyMjkgMTQ3IDIzMi41IDE1MC4wIFEgMjM2IDE1MyAyNDAuMCAxNTMuMCBRIDI0NCAxNTMgMjQ4LjAgMTU0LjUgUSAyNTIgMTU2IDI1Ni41IDE1Ni4wIFEgMjYxIDE1NiAyNjUuMCAxNTQuMCBRIDI2OSAxNTIgMjc0LjUgMTUxLjUgUSAyODAgMTUxIDI4Ny41IDE0NS4wIFEgMjk1IDEzOSAyOTguNSAxMzkuMCBRIDMwMiAxMzkgMzA1LjAgMTQxLjUgUSAzMDggMTQ0IDMxMy41IDE0My41IFEgMzE5IDE0MyAzMjAuMCAxNDQuNSBRIDMyMSAxNDYgMzE1LjAgMTYwLjAgUSAzMDkgMTc0IDMxMS4wIDE3Ni4wIFEgMzEzIDE3OCAzMTkuMCAxNzcuMCBRIDMyNSAxNzYgMzI2LjUgMTc3LjUgUSAzMjggMTc5IDMzMS4wIDE3Ni41IFEgMzM0IDE3NCAzMzcuNSAxNzQuMCBRIDM0MSAxNzQgMzQ3LjAgMTgwLjAgUSAzNTMgMTg2IDM1My41IDE4OS41IFEgMzU0IDE5MyAzNDYuNSAxOTIuMCBRIDMzOSAxOTEgMzM0LjUgMTkyLjUgUSAzMzAgMTk0IDMyOS4wIDE5NS41IFEgMzI4IDE5NyAzMjUuMCAxOTcuMCBRIDMyMiAxOTcgMzE5LjUgMTk5LjUgUSAzMTcgMjAyIDMxNi41IDIwNC41IFEgMzE2IDIwNyAzMTMuMCAyMDkuMCBRIDMxMCAyMTEgMzA1LjAgMjExLjAgUSAzMDAgMjExIDI5NS41IDIxNS41IFEgMjkxIDIyMCAyODcuNSAyMjAuMCBRIDI4NCAyMjAgMjgwLjUgMjE4LjAgUSAyNzcgMjE2IDI3NC41IDIxNi4wIFEgMjcyIDIxNiAyNjguNSAyMjEuMCBRIDI2NSAyMjYgMjY4LjAgMjMxLjAgUSAyNzEgMjM2IDI2Ny4wIDIzOC4wIFEgMjYzIDI0MCAyNTkuMCAyNDQuNSBRIDI1NSAyNDkgMjQ5LjUgMjUxLjUgUSAyNDQgMjU0IDIzNy41IDI1My41IFEgMjMxIDI1MyAyMjUuMCAyNTQuMCBRIDIxOSAyNTUgMjA5LjAgMjYwLjAgUSAxOTkgMjY1IDE5Ny41IDI2NS4wIFEgMTk2IDI2NSAxOTQuNSAyNjMuMCBRIDE5MyAyNjEgMTg5LjUgMjYyLjAgUSAxODYgMjYzIDE4Mi41IDI2MS4wIFEgMTc5IDI1OSAxNzMuNSAyNTguMCBRIDE2OCAyNTcgMTY1LjUgMjU0LjUgUSAxNjMgMjUyIDE1NS41IDI1MS4wIFEgMTQ4IDI1MCAxNDAuNSAyNTAuNSBRIDEzMyAyNTEgMTI1LjAgMjQ5LjUgUSAxMTcgMjQ4IDExMy4wIDI0OC41IFEgMTA5IDI0OSAxMDYuNSAyNDYuNSBRIDEwNCAyNDQgMTAwLjUgMjM2LjAgUSA5NyAyMjggOTQuMCAyMjcuNSBRIDkxIDIyNyA4NS4wIDIyMi41IFEgNzkgMjE4IDY4LjAgMjE3LjAgUSA1NyAyMTYgNTMuMCAyMTQuMCBRIDQ5IDIxMiA0OS4wIDIwOS41IFEgNDkgMjA3IDUwLjUgMjA1LjAgUSA1MiAyMDMgNTEuNSAxOTYuMCBRIDUxIDE4OSA0NS41IDE4MS41IFEgNDAgMTc0IDM0LjUgMTcyLjUgUSAyOSAxNzEgMjUuMCAxNjcuNSBRIDIxIDE2NCAyMS4wIDE2MS4wIFEgMjEgMTU4IDIyLjAgMTU0LjUgUSAyMyAxNTEgMjcuMCAxNTEuMCBRIDMxIDE1MSAzNi41IDE0Ni4wIFEgNDIgMTQxIDUzLjUgMTM1LjUgUSA2NSAxMzAgNjguMCAxMzAuMCBRIDcxIDEzMCA3Mi4wIDEzMS41IFEgNzMgMTMzIDc4LjAgMTMzLjAgUSA4MyAxMzMgODYuMCAxMzcuNSBRIDg5IDE0MiA5Mi41IDE0My4wIFEgOTYgMTQ0IDEwNC41IDE0NC4wIFEgMTEzIDE0NCAxMTUuNSAxNDUuNSBRIDExOCAxNDcgMTIxLjUgMTQ1LjAgUSAxMjUgMTQzIDEyNy4wIDE0MC4wIFEgMTI5IDEzNyAxMjYuNSAxMzEuMCBRIDEyNCAxMjUgMTI1LjAgMTIyLjAgUSAxMjYgMTE5IDEzMC4wIDExNC41IFEgMTM0IDExMCAxMzQuNSAxMDkuNSBaIiBmaWxsPSIjZmZmZmZmIi8+CiAgICA8Y2lyY2xlIGN4PSIxODYuNSIgY3k9IjE4Ni41IiByPSIxNzAiIGZpbGw9InVybCgjdmlnbmV0dGUpIi8+CiAgICA8ZWxsaXBzZSBjeD0iMTUwIiBjeT0iMTIwIiByeD0iMTIwIiByeT0iOTIiIGZpbGw9InVybCgjc3BlYykiLz4KICAgIAogICAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTg2LjUsMTkzKSBzY2FsZSgxLjQyKSB0cmFuc2xhdGUoLTE4Ni41LC0xOTcpIj4KICAgICAgPCEtLSDRgdKv0q/QtNGN0YAgLS0+CiAgICAgIDxlbGxpcHNlIGN4PSIxODYuNSIgY3k9IjI1MCIgcng9IjQ2IiByeT0iNyIgZmlsbD0iIzAwMjA1ZSIgb3BhY2l0eT0iMC4xOCIvPgogICAgICA8IS0tINGC0YPQu9Cz0YPRg9GA0YvQvSDRhdOp0LsgLS0+CiAgICAgIDxnIHN0cm9rZT0iI0E4NkEwMCIgc3Ryb2tlLXdpZHRoPSI3IiBzdHJva2UtbGluZWNhcD0icm91bmQiPgogICAgICAgIDxsaW5lIHgxPSIxODYuNSIgeTE9IjE5NiIgeDI9IjE1MiIgeTI9IjI0OCIvPgogICAgICAgIDxsaW5lIHgxPSIxODYuNSIgeTE9IjE5NiIgeDI9IjIyMSIgeTI9IjI0OCIvPgogICAgICAgIDxsaW5lIHgxPSIxODYuNSIgeTE9IjE5NiIgeDI9IjE4Ni41IiB5Mj0iMjUxIi8+CiAgICAgIDwvZz4KICAgICAgPGcgc3Ryb2tlPSIjRkZDMDJFIiBzdHJva2Utd2lkdGg9IjMuNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIj4KICAgICAgICA8bGluZSB4MT0iMTg2LjUiIHkxPSIxOTYiIHgyPSIxNTIiIHkyPSIyNDgiLz4KICAgICAgICA8bGluZSB4MT0iMTg2LjUiIHkxPSIxOTYiIHgyPSIyMjEiIHkyPSIyNDgiLz4KICAgICAgICA8bGluZSB4MT0iMTg2LjUiIHkxPSIxOTYiIHgyPSIxODYuNSIgeTI9IjI1MSIvPgogICAgICA8L2c+CiAgICAgIDxnIGZpbGw9IiNGMkE2MEIiIHN0cm9rZT0iIzdBNEQwMCIgc3Ryb2tlLXdpZHRoPSIxLjQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPgogICAgICAgIDwhLS0g0YLRgNC40LHRgNCw0YUg0YHRg9GD0YDRjCAtLT4KICAgICAgICA8cGF0aCBkPSJNMTY5IDE5MCBMMjA0IDE5MCBMMTk3IDIwMCBMMTc2IDIwMCBaIi8+CiAgICAgICAgPCEtLSDQsdCw0LPQsNC90LAgLS0+CiAgICAgICAgPHJlY3QgeD0iMTgwIiB5PSIxNzIiIHdpZHRoPSIxMyIgaGVpZ2h0PSIyMCIgcng9IjIiLz4KICAgICAgICA8IS0tINGF0L7RkdGAINGC0YPQu9Cz0YPRg9GAINCx0LDQs9Cw0L3QsCAtLT4KICAgICAgICA8cmVjdCB4PSIxNzEiIHk9IjE1MCIgd2lkdGg9IjciIGhlaWdodD0iMjgiIHJ4PSIyIi8+CiAgICAgICAgPHJlY3QgeD0iMTk1IiB5PSIxNTAiIHdpZHRoPSI3IiBoZWlnaHQ9IjI4IiByeD0iMiIvPgogICAgICAgIDwhLS0g0LTRg9GA0LDQvSAo0YXRjdCy0YLRjdGNKSAtLT4KICAgICAgICA8cmVjdCB4PSIxNjAiIHk9IjE1NiIgd2lkdGg9IjUzIiBoZWlnaHQ9IjE1IiByeD0iNyIvPgogICAgICAgIDwhLS0g0L7QsdGK0LXQutGC0LjQsiAvINC+0LrRg9C70Y/RgCAtLT4KICAgICAgICA8cmVjdCB4PSIxNTYiIHk9IjE1OSIgd2lkdGg9IjYiIGhlaWdodD0iOSIgcng9IjIiLz4KICAgICAgICA8cmVjdCB4PSIyMTEiIHk9IjE1OSIgd2lkdGg9IjgiIGhlaWdodD0iOSIgcng9IjIiLz4KICAgICAgICA8IS0tINCx0LDRgNC40YPQuyAtLT4KICAgICAgICA8cGF0aCBkPSJNMTczIDE1MCBRMTg2LjUgMTM4IDIwMCAxNTAgTDIwMCAxNTQgUTE4Ni41IDE0NCAxNzMgMTU0IFoiLz4KICAgICAgPC9nPgogICAgICA8IS0tINCz0Y/Qu9Cx0LDQsCAtLT4KICAgICAgPHJlY3QgeD0iMTYzIiB5PSIxNTgiIHdpZHRoPSIyMCIgaGVpZ2h0PSI0IiByeD0iMiIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC41Ii8+CiAgICA8L2c+CiAgPC9nPgoKICA8Y2lyY2xlIGN4PSIxODYuNSIgY3k9IjE4Ni41IiByPSIxNjUuNSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utb3BhY2l0eT0iMC4yNSIgc3Ryb2tlLXdpZHRoPSIyIi8+Cjwvc3ZnPgo=';

const ORG = 'Геодези, зураг зүйн удирдлагын нэгдсэн систем';
const PORTAL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://geodesy.gov.mn';
const TICKET_URL = 'https://geodesy.gov.mn/dashboard/ticket/';
const EMAIL = 'admin@geodesy.gov.mn';
const PHONE = '262461';

// Домэйн → системийн нэр
const SYSTEMS = {
  'geodesy.gov.mn': 'Үндсэн систем',
  'point.geodesy.gov.mn': 'Цэг тэмдэгт',
  'geoname.geodesy.gov.mn': 'Газар зүйн нэр',
  'monpos.geodesy.gov.mn': 'MONPOS',
  'border.geodesy.gov.mn': 'Хилийн тэмдэг',
  'lab.geodesy.gov.mn': 'Багаж баталгаажуулалт',
  'eservice.geodesy.gov.mn': 'Захиалгат ажил',
  'map.geodesy.gov.mn': 'Дунд масштаб',
};

const TEXT = {
  403: {
    title: 'Хандах эрхгүй',
    desc: 'Энэ хуудас эсвэл мэдээлэлд хандах эрх танд олгогдоогүй байна.',
    hint: 'Эрх шаардлагатай бол системийн админд хандана уу.',
    tone: '#B71D18',
    soft: '#FFE9D5',
  },
  404: {
    title: 'Хуудас олдсонгүй',
    desc: 'Таны хайсан хуудас устгагдсан, хаяг нь өөрчлөгдсөн эсвэл түр ашиглах боломжгүй байна.',
    hint: 'Хаягаа шалгаад дахин оролдоно уу.',
    tone: '#2065D1',
    soft: '#E8F0FC',
  },
  500: {
    title: 'Системийн алдаа гарлаа',
    desc: 'Хүсэлтийг боловсруулах явцад алдаа гарлаа. Бид шалгаж засах болно.',
    hint: 'Түр хүлээгээд дахин оролдоно уу.',
    tone: '#B76E00',
    soft: '#FFF5CC',
  },
};

const pad = (n) => String(n).padStart(2, '0');

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Barlow:wght@300&display=swap');
.gerr{--bg:#F4F6F8;--surface:#FFFFFF;--text:#1C252E;--muted:#637381;--faint:#919EAB;--line:#E3E8EE;
  --grid:rgba(32,101,209,.06);--primary:#2065D1;--primary-soft:#E8F0FC;--on-primary:#FFFFFF;
  position:fixed;inset:0;z-index:2000;overflow:auto;background:var(--bg);color:var(--text);
  font-family:Montserrat,'Segoe UI',Roboto,system-ui,sans-serif;font-size:15px;line-height:1.6}
@media (prefers-color-scheme:dark){.gerr{--bg:#141A21;--surface:#1C252E;--text:#F4F6F8;--muted:#A3B0BD;--faint:#76828F;
  --line:#2A3440;--grid:rgba(118,176,241,.06);--primary:#5B9BF0;--primary-soft:#1D2F4A;--on-primary:#0E1620}}
.gerr *{box-sizing:border-box}
.gerr-page{position:relative;min-height:100%;display:flex;align-items:center;justify-content:center;padding:48px 16px}
.gerr-page::before{content:'';position:fixed;inset:0;pointer-events:none;
  background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);
  background-size:48px 48px;-webkit-mask-image:radial-gradient(ellipse at center,#000 30%,transparent 75%);
  mask-image:radial-gradient(ellipse at center,#000 30%,transparent 75%)}
.gerr-card{position:relative;width:100%;max-width:560px;background:var(--surface);border:1px solid var(--line);border-radius:20px;
  padding:40px 40px 28px;text-align:center;box-shadow:0 1px 2px rgba(28,37,46,.04),0 24px 48px -24px rgba(28,37,46,.18)}
.gerr-brand{display:flex;flex-direction:column;align-items:center;gap:10px;padding-bottom:28px;border-bottom:1px solid var(--line)}
.gerr-brand img{width:72px;height:72px;object-fit:contain}
.gerr-org{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.gerr-sys{font-size:18px;font-weight:700;color:var(--primary);line-height:1.2;min-height:22px}
.gerr-status{display:flex;align-items:center;justify-content:center;gap:18px;margin:32px 0 20px}
.gerr-status svg{width:56px;height:56px;flex:none}
.gerr-code{font-family:Barlow,Montserrat,system-ui,sans-serif;font-weight:300;font-size:72px;line-height:1;letter-spacing:.02em;font-variant-numeric:tabular-nums}
.gerr h1{font-size:22px;font-weight:700;margin:0 0 8px;text-wrap:balance}
.gerr-desc{color:var(--muted);margin:0 auto;max-width:44ch}
.gerr-hint{display:inline-block;margin-top:16px;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:500}
.gerr-actions{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin:28px 0}
.gerr-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:8px;font:inherit;font-size:14px;font-weight:600;
  text-decoration:none;cursor:pointer;border:1px solid var(--line);background:transparent;color:var(--text)}
.gerr-btn svg{width:18px;height:18px}
.gerr-btn.primary{background:var(--primary);border-color:var(--primary);color:var(--on-primary)}
.gerr-btn:focus-visible,.gerr-help a:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.gerr-help{text-align:left;padding:16px;border-radius:12px;background:var(--bg)}
.gerr-help h2{margin:0 0 10px;font-size:14px;font-weight:700}
.gerr-help ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.gerr-help a{display:grid;grid-template-columns:36px 1fr auto;gap:12px;align-items:center;padding:10px 12px;border-radius:10px;
  background:var(--surface);border:1px solid var(--line);color:inherit;text-decoration:none}
.gerr-help a:hover{border-color:var(--primary)}
.gerr-ico{width:36px;height:36px;border-radius:8px;display:grid;place-items:center;background:var(--primary-soft);color:var(--primary)}
.gerr-ico svg{width:18px;height:18px}
.gerr-lbl{display:block;font-size:12px;color:var(--muted);line-height:1.3}
.gerr-val{display:block;font-size:14px;font-weight:600;color:var(--text);font-variant-numeric:tabular-nums;word-break:break-all}
.gerr-go{font-size:13px;font-weight:600;color:var(--primary);white-space:nowrap}
.gerr-ref{margin-top:20px;font-size:11.5px;color:var(--faint);font-variant-numeric:tabular-nums;letter-spacing:.02em;word-break:break-all}
@media (max-width:480px){.gerr-card{padding:28px 20px 20px}.gerr-code{font-size:56px}.gerr-status svg{width:44px;height:44px}}
`;

export default function ErrorPage({ code = 500 }) {
  const t = TEXT[code] || TEXT[500];
  const [system, setSystem] = useState('');
  const [ref, setRef] = useState('');

  useEffect(() => {
    const host = window.location.hostname.replace(/^www\./, '');
    setSystem(SYSTEMS[host] || '');
    const d = new Date();
    setRef(
      `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())} · ${window.location.pathname}`
    );
  }, []);

  return (
    <div className="gerr">
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main className="gerr-page">
        <section className="gerr-card">
          <div className="gerr-brand">
            {/* Лого data URI — next/image шаардлагагүй */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO} alt={`${ORG} лого`} />
            <div className="gerr-org">{ORG}</div>
            <div className="gerr-sys">{system}</div>
          </div>

          <div className="gerr-status">
            {/* Гурвалжны цэгийн тэмдэг — геодезийн тулгуур цэгийн тэмдэглэгээ */}
            <svg viewBox="0 0 56 56" fill="none" stroke={t.tone} strokeWidth="2" aria-hidden="true">
              <circle cx="28" cy="28" r="26" strokeOpacity=".25" />
              <path d="M28 12 L44 40 H12 Z" strokeLinejoin="round" />
              <circle cx="28" cy="31" r="3" fill={t.tone} stroke="none" />
            </svg>
            <div className="gerr-code">{code}</div>
          </div>

          <h1>{t.title}</h1>
          <p className="gerr-desc">{t.desc}</p>
          <div className="gerr-hint" style={{ background: t.soft, color: t.tone }}>
            {t.hint}
          </div>

          <div className="gerr-actions">
            <a className="gerr-btn primary" href="/">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 3.2 2.8 10.6a1 1 0 0 0 1.25 1.56L5 11.4V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-8.6l.95.76a1 1 0 0 0 1.25-1.56z" />
              </svg>
              Нүүр хуудас
            </a>
            <a className="gerr-btn" href={PORTAL}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
              </svg>
              Портал руу шилжих
            </a>
            <button type="button" className="gerr-btn" onClick={() => window.history.back()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
              Буцах
            </button>
          </div>

          <section className="gerr-help" aria-labelledby="gerr-help-h">
            <h2 id="gerr-help-h">Тусламж хэрэгтэй юу?</h2>
            <ul>
              <li>
                <a href={`mailto:${EMAIL}`}>
                  <span className="gerr-ico">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m4 7 8 6 8-6" />
                    </svg>
                  </span>
                  <span>
                    <span className="gerr-lbl">Системийн админд имэйл</span>
                    <span className="gerr-val">{EMAIL}</span>
                  </span>
                  <span />
                </a>
              </li>
              <li>
                <a href={`tel:${PHONE}`}>
                  <span className="gerr-ico">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
                    </svg>
                  </span>
                  <span>
                    <span className="gerr-lbl">Утас</span>
                    <span className="gerr-val">{PHONE}</span>
                  </span>
                  <span />
                </a>
              </li>
              <li>
                <a href={TICKET_URL} target="_blank" rel="noopener noreferrer">
                  <span className="gerr-ico">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 5h16v11H9l-5 4z" />
                      <path d="M8 9h8M8 12h5" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span>
                    <span className="gerr-lbl">Тусламжийн хүсэлт</span>
                    <span className="gerr-val">Хүсэлт илгээх</span>
                  </span>
                  <span className="gerr-go">Нээх →</span>
                </a>
              </li>
            </ul>
          </section>

          <div className="gerr-ref">
            Алдааны код {code}
            {ref ? ` · ${ref}` : ''}
          </div>
        </section>
      </main>
    </div>
  );
}

ErrorPage.propTypes = {
  code: PropTypes.oneOf([403, 404, 500]),
};
