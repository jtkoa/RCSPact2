import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LanguageProvider, useI18n } from "./i18n/LanguageProvider";
import { AssessmentPage } from "./pages/AssessmentPage";
import { HomePage } from "./pages/HomePage";
import { PropertyPage } from "./pages/PropertyPage";
import { ReportPage } from "./pages/ReportPage";
import { ResourcesPage } from "./pages/ResourcesPage";
import { RoadmapPage } from "./pages/RoadmapPage";

function MissingPage() {
  const { t } = useI18n();
  return (
    <div className="notice notice-stop">
      <h1>{t("page.missingTitle")}</h1>
      <p>{t("page.missingBody")}</p>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/property/:id" element={<PropertyPage />} />
            <Route path="/property/:id/assessment" element={<AssessmentPage />} />
            <Route path="/property/:id/report" element={<ReportPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/roadmap" element={<RoadmapPage />} />
            <Route path="*" element={<MissingPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </LanguageProvider>
  );
}
