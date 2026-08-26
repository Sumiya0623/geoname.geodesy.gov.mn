// ----------------------------------------------------------------------
// Монгол кирилл цагаан толгойн эрэмбэ (А→Я).
//
// ЯАГААД тусдаа бичив: Ө (U+04E8) ба Ү (U+04AE) нь Юникодын дарааллаар Я-гаас
// ХОЙШ байдаг тул энгийн Array.sort() эсвэл localeCompare() (ICU-д "mn" байхгүй
// орчинд) «Өвөр», «Үзүүр» гэх нэрсийг жагсаалтын сүүл рүү хаядаг.
// Толгойн индексээр харьцуулснаар орчноос үл хамааран тогтвортой эрэмбэлнэ.
// ----------------------------------------------------------------------

const MN_ALPHABET = "АБВГДЕЁЖЗИЙКЛМНОӨПРСТУҮФХЦЧШЩЪЫЬЭЮЯ";

const ORDER = new Map();
[...MN_ALPHABET].forEach((ch, i) => {
  ORDER.set(ch, i);
  ORDER.set(ch.toLowerCase(), i);
});

// Толгойд байхгүй тэмдэгт (латин, тоо, зай) — цагаан толгойн ДАРАА, өөр хооронд
// нь код дарааллаар. Ингэснээр «1-р баг» мэтийг сүүлд нь тавина.
const AFTER = MN_ALPHABET.length;

function rank(ch) {
  const r = ORDER.get(ch);
  return r === undefined ? AFTER + ch.charCodeAt(0) : r;
}

/** localeCompare-ийн оронд ашиглах харьцуулагч: mnCompare(a, b) → -1 | 0 | 1 */
export function mnCompare(a, b) {
  const x = String(a ?? "").trim();
  const y = String(b ?? "").trim();
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i += 1) {
    const d = rank(x[i]) - rank(y[i]);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  if (x.length === y.length) return 0;
  return x.length < y.length ? -1 : 1;
}

/** Объектын жагсаалтыг талбараар нь (анхдагч: name) А→Я эрэмбэлнэ. */
export function sortMn(list, key = "name") {
  return [...(list || [])].sort((a, b) => mnCompare(a?.[key], b?.[key]));
}

export default sortMn;
