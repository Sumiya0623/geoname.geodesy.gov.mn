import ErrorPage from 'src/components/error/error-page';

// Нийтлэг алдааны хуудас — бүх системд ижил (src/components/error/error-page.js)
export default function View500() {
  return <ErrorPage code={500} />;
}
