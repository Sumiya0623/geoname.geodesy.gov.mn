import { format, getTime, formatDistanceToNow } from 'date-fns';

// ----------------------------------------------------------------------

export function fDate(date, newFormat) {
  const fm = newFormat || 'dd MMM yyyy';
  if (!date) return '';
  // «YYYY-MM-DD» (цаггүй) утгыг ОРОН НУТГИЙН өдөр гэж уншина — new Date(str)
  // нь UTC шөнө дунд гэж ойлгодог тул цагийн бүсээс шалтгаалж нэг хоног зөрдөг.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(date))
    ? parseApiDate(date)
    : new Date(date);
  return d ? format(d, fm) : '';
}

// ----------------------------------------------------------------------
// ЗӨВХӨН ОГНОО (цаггүй) талбарт зориулсан 2 туслах.
//
// Асуудал: DatePicker нь сонгосон өдрийг ОРОН НУТГИЙН шөнө дунд (00:00) гэж
// өгдөг. `toISOString()` нь UTC руу хөрвүүлдэг тул Улаанбаатарт (+8/+9)
// 1983‑05‑28 00:00 → 1983‑05‑27T15:00Z болж, серверт НЭГ ХОНОГ ЗӨРЖ хадгалагдана.
// Иймд илгээхдээ орон нутгийн жил/сар/өдрийг шууд бичнэ, буцааж уншихдаа
// «YYYY‑MM‑DD»‑ийг ОРОН НУТГИЙН шөнө дунд болгож задална (UTC болгохгүй).
// ----------------------------------------------------------------------

export function toApiDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseApiDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fTime(date, newFormat) {
  const fm = newFormat || 'p';

  return date ? format(new Date(date), fm) : '';
}

export function fDateTime(date, newFormat) {
  const fm = newFormat || 'dd MMM yyyy p';

  return date ? format(new Date(date), fm) : '';
}

export function fTimestamp(date) {
  return date ? getTime(new Date(date)) : '';
}

export function fToNow(date) {
  return date
    ? formatDistanceToNow(new Date(date), {
        addSuffix: true,
      })
    : '';
}

export function isBetween(inputDate, startDate, endDate) {
  const date = new Date(inputDate);

  const results =
    new Date(date.toDateString()) >= new Date(startDate.toDateString()) &&
    new Date(date.toDateString()) <= new Date(endDate.toDateString());

  return results;
}

export function isAfter(startDate, endDate) {
  const results =
    startDate && endDate ? new Date(startDate).getTime() > new Date(endDate).getTime() : false;

  return results;
}
